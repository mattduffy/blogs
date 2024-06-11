/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file lib/redis-client.js The low-level connection object of redis.
 */

import * as Dotenv from 'dotenv' // eslint-disable-line import/no-extraneous-dependencies
import fs from 'node:fs/promises'
import path from 'node:path'
// import { createClient } from 'redis'
import { Redis as Io } from 'ioredis' // eslint-disable-line import/no-extraneous-dependencies
import Debug from 'debug'

const debug = Debug('albums:redis_conn_test')
async function redisConn(configPath = null, configObj = null) {
  let redisEnv = {}
  if (configPath) {
    Dotenv.config({
      path: path.resolve(configPath),
      processEnv: redisEnv,
      debug: true,
      encoding: 'utf8',
    })
  } else {
    redisEnv = { ...configObj }
  }

  const sentinelPort = redisEnv.SENTINEL_PORT ?? 36379
  const redisConnOpts = {
    sentinels: [
      { host: redisEnv.REDIS_SENTINEL_01, port: sentinelPort },
      { host: redisEnv.REDIS_SENTINEL_02, port: sentinelPort },
      { host: redisEnv.REDIS_SENTINEL_03, port: sentinelPort },
    ],
    name: redisEnv.REDIS_NAME ?? 'myprimary',
    db: redisEnv.REDIS_DB ?? 0,
    keyPrefix: `${redisEnv.REDIS_KEY_PREFIX}:` ?? 'test:',
    sentinelUsername: redisEnv.REDIS_SENTINEL_USER,
    sentinelPassword: redisEnv.REDIS_SENTINEL_PASSWORD,
    username: redisEnv.REDIS_USER,
    password: redisEnv.REDIS_PASSWORD,
    connectionName: 'ioredis',
    enableTLSForSentinelMode: true,
    sentinelRetryStrategy: 100,
    tls: {
      ca: await fs.readFile(redisEnv.REDIS_CACERT),
      rejectUnauthorized: false,
      requestCert: true,
    },
    sentinelTLS: {
      ca: await fs.readFile(redisEnv.REDIS_CACERT),
      rejectUnauthorized: false,
      requestCert: true,
    },
    showFriendlyErrorStack: true,
  }
  debug(redisConnOpts)
  const client = new Io(redisConnOpts)
  return client
}
export { redisConn }
