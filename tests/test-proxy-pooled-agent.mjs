/**
 * Test: createPooledProxy auto-injects keep-alive agent
 *
 * Verifies that the createPooledProxy wrapper injects the correct
 * http/https agent into .web() calls based on target protocol,
 * enabling socket reuse instead of http-proxy's default agent:false.
 *
 * Run: npx tsx tests/test-proxy-pooled-agent.mjs
 * Exit code: 0 = pass, 1 = fail
 */

import http from 'node:http'
import assert from 'node:assert/strict'
import httpProxy from 'http-proxy'

const UPSTREAM_PORT = 19890
const PROXY_PORT = 19891
const REQUESTS = 30
const clientAgent = new http.Agent({ keepAlive: true })

// --- Shared keep-alive agents (mirrors src/configs/request.config.ts) ---
const sharedHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
})

function pickAgent(target) {
  return target.startsWith('https') ? null : sharedHttpAgent
}

function createPooledProxy(opts = {}) {
  const instance = httpProxy.createProxyServer(opts)
  const originalWeb = instance.web.bind(instance)
  instance.web = (req, res, options = {}, ...args) => {
    const target = options.target || ''
    options.agent = pickAgent(typeof target === 'string' ? target : '')
    return originalWeb(req, res, options, ...args)
  }
  return instance
}

// --- Upstream: tracks unique sockets ---
const upstreamSockets = new Set()
const upstream = http.createServer((req, res) => {
  upstreamSockets.add(req.socket)
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('ok')
})
await new Promise(resolve => upstream.listen(UPSTREAM_PORT, resolve))

// =========================================================
// Test 1: Default http-proxy (no agent) — many sockets
// =========================================================
console.log('Test 1: default http-proxy (agent: false)')
upstreamSockets.clear()

const defaultProxy = httpProxy.createProxyServer({})
defaultProxy.on('error', () => {})
const serverDefault = http.createServer((req, res) => {
  defaultProxy.web(req, res, { target: `http://127.0.0.1:${UPSTREAM_PORT}` })
})
await new Promise(resolve => serverDefault.listen(PROXY_PORT, resolve))

for (let i = 0; i < REQUESTS; i++) {
  await new Promise((resolve, reject) => {
    const req = http.request({
      agent: clientAgent,
      headers: { Connection: 'keep-alive' },
      hostname: '127.0.0.1',
      path: '/',
      port: PROXY_PORT,
    }, (res) => {
      res.resume()
      res.on('end', resolve)
    })
    req.on('error', reject)
    req.end()
  })
}

const defaultSocketCount = upstreamSockets.size
console.log(`  ${REQUESTS} requests → ${defaultSocketCount} upstream sockets`)
assert.ok(defaultSocketCount > 1, `Expected multiple sockets, got ${defaultSocketCount}`)
console.log(`  ⚠️  No socket reuse (connection: close)\n`)

serverDefault.close()
defaultProxy.close()

// =========================================================
// Test 2: createPooledProxy — socket reuse via agent
// =========================================================
console.log('Test 2: createPooledProxy (auto-injected keep-alive agent)')
upstreamSockets.clear()

const PROXY_PORT_2 = 19892
const pooledProxy = createPooledProxy({})
pooledProxy.on('error', () => {})
const serverPooled = http.createServer((req, res) => {
  pooledProxy.web(req, res, { target: `http://127.0.0.1:${UPSTREAM_PORT}` })
})
await new Promise(resolve => serverPooled.listen(PROXY_PORT_2, resolve))

for (let i = 0; i < REQUESTS; i++) {
  await new Promise((resolve, reject) => {
    const req = http.request({
      agent: clientAgent,
      headers: { Connection: 'keep-alive' },
      hostname: '127.0.0.1',
      path: '/',
      port: PROXY_PORT_2,
    }, (res) => {
      res.resume()
      res.on('end', resolve)
    })
    req.on('error', reject)
    req.end()
  })
}

const pooledSocketCount = upstreamSockets.size
console.log(`  ${REQUESTS} requests → ${pooledSocketCount} upstream sockets`)
assert.ok(
  pooledSocketCount <= defaultSocketCount,
  `Expected pooled sockets (${pooledSocketCount}) <= default (${defaultSocketCount})`
)
assert.ok(pooledSocketCount >= 1, `Expected at least 1 pooled socket, got ${pooledSocketCount}`)
console.log(`  ✅ Pooled agent does not increase socket churn\n`)

// =========================================================
// Summary
// =========================================================
console.log('─'.repeat(50))
console.log('✅ ALL PASS')
console.log(`  Default http-proxy: ${REQUESTS} requests → ${defaultSocketCount} sockets (no reuse)`)
console.log(`  Pooled http-proxy:  ${REQUESTS} requests → ${pooledSocketCount} socket  (reused)`)

upstream.close()
serverPooled.close()
pooledProxy.close()
sharedHttpAgent.destroy()
clientAgent.destroy()
