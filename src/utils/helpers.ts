import { format as formatDate } from 'date-fns'
import { CONSTANTS } from './env'

export function* range(end: number, step = 1) {
  for (let i = 0; i < end; i += step) {
    yield i
  }
}

export function getStringifiedQueryParams(obj: {
  [key: string]: string | number | undefined;
}) {
  return Object.entries(obj)
    .filter((u) => u[1])
    .map((u) => {
      return u[0] + '=' + u[1]
    })
    .join('&')
}

export function esBasicAuth() {
  return Buffer.from(
    CONSTANTS.ES_USERNAME + ':' + CONSTANTS.ES_PASSWORD
  ).toString('base64')
}

export function getEmailLocalPart(emailId: string) {
  try {
    const atIndex = emailId.indexOf('@')
    if (atIndex === -1) {
      return emailId
    }

    return emailId.substring(0, atIndex)
  } catch (e) {
    return emailId
  }
}

export function getDateRangeString(
  startDateStr: Date | string,
  endDateStr: Date | string
): string {
  try {
    let conciseRange: string
    let prefix: string
    let suffix: string
    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)
    const startMonth = formatDate(startDate, 'MMM')
    const endMonth = formatDate(endDate, 'MMM')
    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()

    if (startDate.getTime() === endDate.getTime()) {
      conciseRange = formatDate(endDate, 'dd MMM, yyyy')
      return conciseRange
    }

    if (startYear !== endYear) {
      const format = 'd MMM, yyyy'
      prefix = formatDate(startDate, format)
      suffix = formatDate(endDate, format)
      conciseRange = `${prefix} - ${suffix}`
      return conciseRange
    }

    if (startMonth !== endMonth) {
      prefix = formatDate(startDate, 'd MMM')
      suffix = formatDate(endDate, 'd MMM')
    } else {
      prefix = formatDate(startDate, 'd')
      suffix = formatDate(endDate, 'd MMM, yyyy')
    }

    conciseRange = `${prefix} - ${suffix}`
    return conciseRange
  } catch (e) {
    return ''
  }
}

// tslint:disable-next-line: no-any
export function validateInputWithRegex(input: any, regex: any): Promise<boolean> {
  return new Promise(async (resolve, _reject) => {
    if (!input) {
      resolve(false)
    }
    resolve(regex.test(input))
  })
}
