/**
 * @module @mattduffy/blogs
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/Blogs.js An interface to work with multiple blogs.
 */

import { Blog } from './Blog.js'
import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _error as _Error,
} from './utils/debug.js'

// const _log = Log.extend('Blog')
// const _error = _Error.extend('Blog')

const BLOGS = 'blogs'
const PUBLICBLOGS = 'publicBlogsView'

class Blogs {
  static #emptyMessage = 'Nothing here yet.'

  static #log = Log.extend('Blog')

  static #error = _Error.extend('Blog')

  #type = 'Blogs'

  #redis

  #mongo

  constructor(config = {}) {
    this.#redis = config?.redis ?? null
    this.#mongo = config?.mongo ?? null
  }

  /**
   * Create a new blog instance from form data.
   * @summary Create a new blog instance from form data.
   * @author Matthew Dufffy <mattduffy@gmail.com>
   * @param { MongoClient|Collection } mongo - Either a mongodb client connection or its blog collection.
   * @param { Object } o - An object literal with minimum required blog details.
   * @param { String } o.description - A string containing the blog description.
   * @param { String } o.title - A string containing the blog title.
   * @param { String[] } o.keywords - An array of keywords.
   * @param { Redis } redis - A redis client connection instance.
   * @return { Blog|Boolean } - A populated instance of a Blog, or false if failed.
   */
  static async newBlog(mongo, o, redis) {
    const log = this.#log.extend('newBlog')
    if (!mongo) return false
    if (!o) return false
    if (!redis) return false
    log('Creating a new blog...')
    let collection
    if (!mongo.s.namespace.collection) {
      console.log('Setting db collection to: ', BLOGS)
      collection = mongo.collection(BLOGS)
    } else {
      log('Collection is already set to: ', mongo.collectionName)
      collection = mongo
    }
    log(o)
    return new Blog({
      dbName: 'mattmadethese',
      collection,
      redis,
      ...o,
    })
  }

  /*
   * Find a saved blog in the database by given username and return as a Blog instance.
   * @summary Find a saved blog in the database by given username and return as a Blog instance.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { MongoClient|Collection } mongo - Either a mongodb client connection or its blog collection.
   * @param { Redis } redis - A redis client connection instance.
   * @param { String } username - The string value of a username to search the db for.
   * @return { Blog|Boolean } - A populated instance of a Blog if found, otherwise false.
   */
  static async getByUsername(mongo, username, redis) {
    const log = this.#log.extend('getByUsername')
    const error = this.#error.extend('getByUsername')
    if (!mongo) return false
    if (!username) return false
    let collection
    if (!mongo.s.namespace.collection) {
      log('Setting db collection to: ', BLOGS)
      collection = mongo.collection(BLOGS)
    } else {
      log('Collection is already set: ', mongo.collectionName)
      collection = mongo
    }
    let found
    try {
      const filter = { creatorName: username }
      found = await collection.findOne(filter)
      log(found)
      found.mongo = mongo
      found.collection = collection
      found.redis = redis
      return await new Blog(found).init()
    } catch (e) {
      error(e)
    }
    return false
  }

  /*
   * Find a saved blog in the database by given id value and return as an Album instance.
   * @summary Find a saved blog in the database by give id value and return as an Album instance.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { MongoClient|Collection } mongo - Either a mongodb client connection or its blog collection.
   * @param { Redis } redis - A redis client connection instance.
   * @param { String } id - The string value of an ObjectId to search the db for.
   * @return { Album|Boolean } - A populated instance of an Album if found, otherwise false.
   */
  static async getById(mongo, id, redis) {
    const log = this.#log.extend('getById')
    const error = this.#error.extend('getById')
    if (!mongo) return false
    if (!id) return false
    let collection
    if (!mongo.s.namespace.collection) {
      log('Setting db collection to: ', BLOGS)
      collection = mongo.collection(BLOGS)
    } else {
      log('Collection is already set: ', mongo.collectionName)
      collection = mongo
    }
    let found
    try {
      found = await collection.findOne({ _id: new ObjectId(id) })
      log(`found: ${found.title}`)
      found.mongo = mongo
      found.collection = collection
      found.redis = redis
      return await new Blog(found).init()
    } catch (e) {
      error(e)
    }
    return false
  }

  /**
   * Get a list of publicly accessible blogs.
   * @summary Get a list of publicly accessible blogs.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { MongoClient|Collection } mongo - Either a mongodb client connection or its blog collection.
   * @return { Object[] } - An array of objects listing public blog details.
   */
  static async usersWithPublicBlogs(mongo) {
    const log = this.#log.extend('usersWithPublicBlogs')
    const error = this.#error.extend('usersWithPublicBlogs')
    if (!mongo) return false
    let collection
    // if (!mongo.s.namespace.collection) {
    if (!mongo.s.namespace.collection !== PUBLICBLOGS) {
      log('Setting db collection to: ', PUBLICBLOGS)
      collection = mongo.collection(PUBLICBLOGS)
    } else {
      log('Collection is already set: ', mongo.collectionName)
      collection = mongo
    }
    let found
    try {
      found = await collection.find()
    } catch (e) {
      error(e)
    }
    return found.toArray()
  }

  /**
   * Get a list of recenlty updated blogs.
   * @summary Get a list of recently updated blogs.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Redis } redis - A redis client connection instance.
   * @return { Object[] } - An array of objects listing recently updated blog details.
   */
  static async recentlyUpdated(redis) {
    // const log = this.#log.extend('recentlyUpdated')
    // const error = this.#error.extend('recentlyUpdated')
    if (!redis) return false
    // return this.#emptyMessage
    return []
  }

  /*
   * Return a list of public and private blog for a specific user account.
   * @summary Return a list of public and private blog for a specific user account.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { (MongoClient|Collection) } mongo - Either a mongodb client connection or its ablum collection.
   * @param { String } username - The name of user for blog list.
   * @return { (Object|Boolean) } - An object literal with public and private list, or false if none found.
   */
  static async list(mongo, user) {
    if (!mongo) return false
    if (!user) return false
    let collection
    if (!mongo.s.namespace.collection) {
      console.log('Setting db collection to: ', BLOGS)
      collection = mongo.collection(BLOGS)
    } else {
      console.log('Collection is already set: ', mongo.collectionName)
      collection = mongo
    }
    const pipeline = []
    const match = {
      $match: {
        creator: user,
      },
    }
    const bucket = {
      $bucket: {
        groupBy: '$public',
        boundaries: [false, true],
        default: 'public',
        output: {
          count: { $sum: 1 },
          blogs: {
            $push: {
              id: '$_id',
              public: '$public',
              name: '$name',
              description: '$description',
            },
          },
        },
      },
    }
    pipeline.push(match)
    pipeline.push(bucket)
    pipeline.push({ $match: { count: { $gt: 0 } } })
    console.log(pipeline)
    console.log(`Looking for blog for user: ${user}`)
    // const blogCursor = await collection.find({ blogOwner: user }).toArray()
    // const blogCursor = await collection.find({ creator: user }, { projection: { name: 1, public: 1, url: 1 } }).toArray()
    const blogBuckets = await collection.aggregate(pipeline).toArray()
    // console.log('blogBuckets: %o', blogBuckets)
    return blogBuckets
  }

  /*
   * Return a list of recently added blog.
   * @summary Return a list of recently added blog.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { RedisClient } redis - Client connection to redis.
   * @param { number } [count=10] - Number of recently added blogs to return, default is 10.
   * @returm { Array } - An array of recently added blogs.
   */
  static async recentlyAdded(redis, count = 10) {
    const recentlyAddedStream = 'blogs:recent:10'
    const response = await redis.xrevrange(recentlyAddedStream, '+', '-', 'COUNT', count)
    console.log(`redis: xrevrange ${recentlyAddedStream} + - COUNT ${count}`)
    console.log(response)
    // [ [ '1687734539621-0', [ 'blog', '{"name":"Here is a sixth one"}' ] ] ]
    const recent10 = response.map((a) => JSON.parse(a[1][1]))
    console.log(recent10)
    return recent10
  }

  /*
   * Return a list of users with publicly accessible blogs.
   * @summary Return a list of users with publicly accessible blogs.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { (MongoClient|Collection) } mongo - Either a mongodb client connection or its ablum collection.
   * @return { (Array|Boolean) } An array of usernames of false if none found.
   */
  static async usersWithPublicAlbums(mongo) {
    const publicBlogsView = 'publicBlogsView'
    const collection = mongo.collection(publicBlogsView)
    const publicList = await collection.find().toArray()
    console.log(publicList)
    return publicList
  }

  get [Symbol.toStringTag]() {
    return this.#type
  }
}
export {
  Blogs,
}
