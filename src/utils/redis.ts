import Redis from 'ioredis'
import { CONSTANTS } from './env'
import { logError, logInfo } from './logger'

export const redis = new Redis(Number(CONSTANTS.IGOT_REDIS_PORT), CONSTANTS.IGOT_REDIS_HOST)

redis.on('connect', () => {
    logInfo('Connected to Redis')
})

// tslint:disable-next-line: no-any
redis.on('error', (err: any) => {
    logError('Redis connection error: ' + err)
})
