/**
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file lib/mongodb-client.js The low-level connection object of mongodb.
 */

import * as Dotenv from 'dotenv' // eslint-disable-line import/no-extraneous-dependencies
import path from 'node:path'
import { MongoClient, ObjectId } from 'mongodb' // eslint-disable-line import/no-extraneous-dependencies
import Debug from 'debug'

const debug = Debug('albums:db_conn_test')
async function mongodb(configPath = null, configObj = null) {
  let mongoEnv = {}
  if (configPath) {
    Dotenv.config({
      path: path.resolve(configPath),
      processEnv: mongoEnv,
      debug: true,
      encoding: 'utf8',
    })
  } else {
    mongoEnv = { ...configObj }
  }

  const dbName = mongoEnv.MONGODB_DB_NAME
  // const colName = process.env.COLLECTION
  const clientDn = mongoEnv.MONGODB_CLIENT_DN
  const dbHost = mongoEnv.MONGODB_HOST
  const dbPort1 = mongoEnv.MONGODB_PORT_1
  const dbPort2 = mongoEnv.MONGODB_PORT_2
  const dbPort3 = mongoEnv.MONGODB_PORT_3
  const authMechanism = 'MONGODB-X509'
  const authSource = '$external'
  const clientPEMFile = encodeURIComponent(mongoEnv.MONGODB_CLIENT_KEY)
  const dbCAKeyFile = encodeURIComponent(mongoEnv.MONGODB_CAKEYFILE)
  const uri = `mongodb://${clientDn}@${dbHost}:${dbPort1},${dbHost}:${dbPort2},${dbHost}:${dbPort3}/${dbName}?replicaSet=myReplicaSet&authMechanism=${authMechanism}&tls=true&tlsCertificateKeyFile=${clientPEMFile}&tlsCAFile=${dbCAKeyFile}&authSource=${authSource}`
  debug(uri)

  const client = new MongoClient(uri)
  await client.connect()
  return client
}

export { mongodb, ObjectId }
