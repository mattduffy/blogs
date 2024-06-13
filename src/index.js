/**
 * @module @mattduffy/blogs
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Blog class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _info as Info,
  _warn as Warn,
  _error as _Error,
} from './utils/debug.js'

const _log = Log.extend('blog')
const _info = Info.extend('blog')
const _warn = Warn.extend('blog')
const _error = _Error.extend('blog')
const BLOGS = 'blogs'

/**
 * A class to model the shape and properties of a blog of posts.
 * @summary A class to model the shape and properties of a blog of posts.
 * @class Blog
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Blog {
  #log

  #error

  #newBlog

  #mongo

  #collection

  #db

  #redis

  #streamId

  #cached

  #rootDir

  #images

  #blogId

  #blogDir

  #blogUrl

  #albumPreviewImage

  #albumImageUrl

  #blogName

  #blogOwner

  #blogJson

  #blogKeywords

  #blogDescription

  #directoryIterator

  /**
   * Create an instance of Blog.
   * @summary Create an instance of Blog.
   * @param { Object } config - An object literal containing configuration properties.
   * @param { Boolean } [config.new = false] - True only if creating a new blog.
   * @param { string } config.rootDir - A string path for the root directory for all blog.
   * @param { string } config.blogId - A string of the unique blog id.
   * @param { string } config.blogDir - A string of the blog file system path.
   * @param { string } config.blogUrl - Path portion of public url for the blog.
   * @param { string } config.blogPreviewImage - Path portion of the url to show blog preview image.
   * @param { string } config.blogImageUrl - Path portion of the public href url from the blog images.
   * @param { string } config.blogName - The name of the blog.
   * @param { string } config.blogOwer - The name of the blog owner.
   * @param { string } config.blogKeywords - The keywords of the blog.
   * @param { string } config.blogDescription - The description of the blog.
   * @param { Object[] } config.blogImages - An array of JSON objects, each describing an image.
   * @param { Boolean } config.public - The visibilty status of the blog.
   * @param { Object } config.redis - An instance of a redis connection.
   * @param { string } [config.streamId = null] - A stream id for redis recently added stream.
   * @param { string } config.dbName - A string with the db name if needed.
   * @param { Object } config.mongo - An instance of a mongoDB connection.
   * @param { Object } config.collection - A refernce to a mongoDB collection.
   * @return { Blog }
   */
  constructor(config = {}) {
    // private properties
    this.#log = _log.extend('constructor')
    this.#error = _error.extend('constructor')
    this.#newBlog = config?.new ?? false
    this.#redis = config?.redis ?? null
    this.#streamId = config?.streamId ?? null
    this.#mongo = config?.mongo ?? config?.db ?? null
    if ((!config.collection) && (!this.#mongo?.s?.namespace?.collection)) {
      console.log(this.#mongo)
      this.#db = this.#mongo.db(config.dbName ?? process.env.DB_NAME).collection(BLOGS)
    } else if (config.collection?.collectionName !== undefined) {
      this.#db = config.collection
    } else {
      this.#db = null
    }
    this.#rootDir = config?.rootDir ?? process.env.ALBUMS_ROOT_DIR ?? null
    this.#rootDir = (this.#rootDir) ? path.resolve(this.#rootDir) : null
    this.#blogId = config?.blogId ?? config.Id ?? config?.id ?? config?._id ?? null
    this.#blogDir = config?.blogDir ?? config?.dir ?? null
    this.#albumPreviewImage = config.albumPreviewImage ?? config.previewImage ?? null
    this.#blogUrl = config?.blogUrl ?? config?.url ?? null
    this.#albumImageUrl = config?.albumImageUrl ?? config?.imageUrl ?? null
    this.#blogName = config?.blogName ?? config.name ?? null
    this.#blogOwner = config?.blogOwner ?? config.owner ?? config?.creator ?? null
    if (config?.blogKeywords) {
      this.#blogKeywords = new Set(config.blogKeywords)
    } else if (config?.keywords) {
      this.#blogKeywords = new Set(config.keywords)
    } else {
      this.#blogKeywords = new Set()
    }
    this.#blogDescription = config?.blogDescription ?? config?.description ?? null
    this.#images = config?.albumImages ?? config?.images ?? []
    // pseudo-protected properties
    // this._directoryIterator = null
    this._blogPublic = config?.public ?? false
    this._numberOfImages = this.#images?.length ?? 0
    this._metadata = null
  }

  /**
   * Run all the async operations to initialize the album.
   * @summary Run all the async operations to initialize the album.
   * @async
   * @throws Error
   * @param { String } dirPath - A string path to the album directory.
   * @return { Album } Return a fully iniitialized album instance.
   */
  async init(dirPath = null) {
    const log = _log.extend('init')
    const error = _error.extend('init')
    if (dirPath) {
      this.#blogDir = path.resolve(dirPath)
    } else {
      this.#blogDir = path.resolve(this.#blogDir)
    }
    const parsedBlogPath = path.parse(this.#blogDir)
    log(parsedBlogPath)
    if (this.#rootDir === null && this.blogDir !== null) {
      if (parsedBlogPath.root === '') {
        throw new Error('No rootDir given and blogDir is incomplete.')
      } else {
        // log('parsedBlogPath: ', parsedBlogPath)
        this.#rootDir = parsedBlogPath.dir
      }
    }
    log(this.#rootDir, '/', this.#blogDir)
    if (!this.#blogUrl) {
      this.#blogUrl += parsedBlogPath.base
      log(`#blog url: ${this.#blogUrl}`)
    }
    if (!this.#albumImageUrl) {
      this.#albumImageUrl += parsedBlogPath.base
      log(`#blog image url: ${this.#albumImageUrl}`)
    }
    let dir
    try {
      dir = await this.#checkRootDirExists()
      log(dir)
      if (!dir) {
        dir = await this.#makeRootDir(this.#rootDir)
      }
    } catch (e) {
      const msg = 'Failed to create directory iterator on blog dir.'
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      await this.#resolveAlbumDirPath()
    } catch (e) {
      const msg = 'Problem resolving album directory path.'
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      this.#directoryIterator = await this.#dir()
      if (this.#images.length > 0) {
        this._numberOfImages = this.#images.length
      } else {
        this.#images = await fs.readdir(this.#blogDir)
        this._numberOfImages = this.#images.length
      }
    } catch (e) {
      const msg = `Failed to set the directory iterator on ${this.#blogDir}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      if (!this.#blogJson) {
        this.#blogJson = await this.createBlogJson()
      }
    } catch (e) {
      const msg = 'Creating blog json failed.'
      error(msg)
      throw new Error(msg, { cause: e })
    }
    return this
  }

  /**
   * Remove album from the redis new albums stream.
   * @summary Remove album from the redis new albums stream.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { Boolean|undefined } - Returns true if successfully removed from the redis stream.
   */
  async removeFromRedisStream() {
    const log = _log.extend('removeFromRedisStream')
    const error = _error.extend('removeFromRedisStream')
    // if (!this._blogPublic) {
    //   return undefined
    // }
    if (this.#streamId) {
      try {
        const response = await this.#redis.xdel('blogs:recent:10', this.#streamId)
        this.#streamId = null
        log(response)
      } catch (e) {
        error(e)
        return false
      }
    }
    return true
  }

  /**
   * Add newly created album to the redis new albums stream.
   * @summary Add newly created album to the redis new albums stream.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { Boolean } - Returns true if successfully added to redis stream.
   */
  async addToRedisStream() {
    const log = _log.extend('addToRedisStream')
    const error = _error.extend('addToRedisStream')
    if (!this.#redis) {
      const msg = 'no redis connection provided'
      error(msg)
      error(msg)
      return false
    }
    if (!this.#blogId) {
      // only add blog with _id values to the redis stream
      log('No #blogId was provided to add to redis stream')
      return false
    }
    if (!this._blogPublic) {
      // only add public blogs to the redis stream
      log('Blog is not public, not added to redis stream.')
      return false
    }
    if (this.#streamId) {
      log(`blog already has a streamId: ${this.#streamId}, clear it and re-add.`)
      try {
        const clear = await this.#redis.xdel('blogs:recent:10', this.#streamId)
        log(clear)
      } catch (e) {
        error(e)
        error(`Failed to remove streamId: ${this.#streamId}`)
      }
    }
    let response
    try {
      log(`adding new blog (id: ${this.#blogId}) to redis stream`)
      const entry = {
        id: this.#blogId,
        name: this.#blogName,
        owner: this.#blogOwner,
        access: this._blogPublic,
        preview: this.#albumPreviewImage,
        description: this.#blogDescription,
      }
      response = await this.#redis.xadd('blogs:recent:10', '*', 'album', JSON.stringify(entry))
      log('xadd response: ', response)
      this.#streamId = response
    } catch (e) {
      error(e)
      return false
    }
    return true
  }

  /**
   * Delete an image.
   * @summary Delete an image.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { String } imageName=null - The name of the image to delete from the album.
   * @throws { Error } Throws an Error if imageName parameter is not provided.
   * @return { Boolean }
   */
  async deleteImage(imageName = null) {
    const log = _log.extend('deleteImage')
    const error = _error.extend('deleteImage')
    if (!imageName) {
      const err = 'Missing required image name parameter.'
      error(err)
      throw new Error(err)
    }
    let deleted = false
    let index
    const image = this.#images.find((i, x) => {
      if (i.name === imageName) {
        index = x
        return true
      }
      return false
    })
    if (image) {
      const parts = path.parse(imageName)
      const imageStar = `${parts.name}*`
      let imagePath
      // const imagePath = path.join(this.#blogDir, imageStar)
      // log(imagePath)
      let files
      const re = new RegExp(imageStar)
      try {
        files = await fs.readdir(this.#blogDir)
      } catch (e) {
        error(e)
        throw new Error('readdir failed', { cause: e })
      }
      try {
        await files
          .filter((file) => re.test(file))
          .forEach(async (file) => {
            imagePath = path.join(this.#blogDir, file)
            log(`about to delete ${imagePath}`)
            deleted = (await fs.rm(imagePath) === undefined)
            log(`Image ${imagePath} was deleted? ${deleted}`)
          })
      } catch (e) {
        const err = `Failed to delete image file ${imageName}`
        error(err)
        error(e)
        throw new Error(err, { cause: e })
      }
      try {
        this.#images.splice(index, 1)
        const saved = await this.save()
        if (!saved) {
          throw new Error('Save() failed, but did not cause an exception.')
        }
      } catch (e) {
        const err = 'Image deleted, but failed to update gallery in db.'
        error(err)
        throw new Error(err, { cause: e })
      }
    }
    return deleted
  }

  /**
   * Delete the album.
   * @summary Delete the album.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Booloean } - True if album is successfully deleted.
   */
  async deleteAlbum() {
    const log = _log.extend('deleteBlog')
    const error = _error.extend('deleteBlog')
    log(`About to delete album: ${this.#blogName}`)
    log(this.#blogDir)
    let deleted
    try {
      log(`Redis streamId: ${this.#streamId}`)
      const removed = await this.removeFromRedisStream()
      log(`streamId: ${removed}`)
      if (!removed) {
        deleted = false
      }
    } catch (e) {
      error(`failed to remove blogId ${this.#blogId}, streamId ${this.#streamId} from redis stream.`)
      error(e)
      deleted = false
    }
    try {
      deleted = await fs.rm(path.resolve(this.#blogDir), { force: true, recursive: true })
    } catch (e) {
      error(e)
      return false
    }
    try {
      const filter = { _id: new ObjectId(this.#blogId) }
      const response = await this.#db.deleteOne(filter)
      if (response.deletedCount !== 1) {
        deleted = false
      }
    } catch (e) {
      error(`failed to remove blogId ${this.#blogId} from db.`)
      error(e)
      deleted = false
    }
    return (deleted === undefined)
  }

  /**
   * Save album json to db.
   * @summary Save album json to db.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws { Error } If no db collection is available.
   * @return { ObjectId|Boolean } Return the new monogdb objectId if successfully saved to db, otherwise false.
   */
  async save() {
    const log = _log.extend('save')
    const error = _error.extend('save')
    if (!this.#db) {
      const msg = `No connection to client collection ${BLOGS}`
      throw new Error(msg)
    }
    if (!this.#blogJson) {
      this.#blogJson = await this.createBlogJson()
    }
    let saved
    let filter
    let theId
    if (this.#newBlog) {
      theId = new ObjectId()
      this.#blogId = theId
    } else {
      theId = new ObjectId(this.#blogId)
    }
    log(`the _id is ${theId}`)
    try {
      if (this._albumPublic) {
        const add = await this.addToRedisStream()
        log(`blog id: ${theId} was added to the redis recent10 stream?`, add)
      } else {
        log(`blog id: ${theId}, streamId: ${this.#streamId}`)
        const remove = await this.removeFromRedisStream()
        log(`blog id: ${theId} was removed from the redis recent10 stream.`, remove)
      }
    } catch (e) {
      saved.redis = { msg: 'Failed to add new blog to redis stream.', e }
      error(e)
    }
    try {
      filter = { _id: new ObjectId(theId) }
      const options = { upsert: true }
      if (!this.#blogId) {
        this.#blogId = new ObjectId(this.#blogId)
        this.#blogJson._id = this.#blogId
        saved = await this.#db.insertOne(this.#blogJson)
      } else {
        log('save filter: %o', filter)
        log('replace doc: %o', this.#blogJson)
        // saved = await this.#db.replaceOne(filter, this.#blogJson, options)
        const update = {
          $set: {
            streamId: this.#streamId,
            dir: this.#blogDir,
            imageUrl: this.#albumImageUrl,
            creator: this.#blogOwner,
            name: this.#blogName,
            url: this.#blogUrl,
            previewImage: this.#albumPreviewImage,
            description: this.#blogDescription,
            keywords: Array.from(this.#blogKeywords),
            public: this._blogPublic,
            images: this.#images,
          },
        }
        if (this.#newBlog) {
          update.$set._id = theId
        }
        log('the update doc: %o', update)
        saved = await this.#db.updateOne(filter, update, options)
        saved.insertedId = this.#blogId
      }
      log('Blog save results: %o', saved)
    } catch (e) {
      const err = 'Failed to save blog json to db.'
      error(err)
      throw new Error(err, { cause: e })
    }

    // modifiedCount, upsertedCount, upsertedId
    // if (!saved?.insertedId || saved?.upsertedCount < 1 || saved?.modifiedCount < 1) {
    if (saved?.modifiedCount < 1 && saved?.upsertedCount < 1 && saved?.matchedCount < 1) {
      return false
    }
    if (!this.#blogId) {
      this.#blogId = saved.insertedId.toString()
    }
    return saved
  }

  /**
   * Resolve the given album directory name into a full file system path.
   * @summary Resolve the given album directory name into a full file system path.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @throws { Error } If directory can't be accessed.
   * @return { undefined }
   */
  #resolveAlbumDirPath() {
    const log = _log.extend('resolveBlogDirPath')
    const error = _error.extend('resolveBlogDirPath')
    log(`rootDir: ${this.#rootDir}`)
    log(`albumDir: ${this.#blogDir}`)
    const p = path.parse(this.#blogDir)
    log(p)
    const pathDiff = path.relative(this.#rootDir, this.#blogDir)
    if (`${this.#rootDir}/${pathDiff}` !== this.#blogDir) {
      error(`rootDir:         ${this.#rootDir}`)
      error(`blogDir:        ${this.#blogDir}`)
      error(`path difference: ${pathDiff}`)
      const err = `Album dir ${this.#blogDir} is not in ${this.#rootDir}`
      throw new Error(err)
    }
    this.#blogDir = path.resolve(this.#blogDir)
  }

  /**
   * Check if the given path to rootDir is valid.
   * @summary Check if the given path to rootDir is valid.
   * @async
   * @param { string } rootPath - A string file system path for the root album directory.
   * @return { boolean } - True if directory exists, false otherwise.
   */
  async #checkRootDirExists(rootPath = null) {
    // const log = _log.extend('checkRootDirExists')
    const info = _info.extend('checkRootDirExists')
    const warn = _warn.extend('checkRootDirExists')
    // const error = _error.extend('checkRootDirExists')
    let stats
    let rootPathTest
    if (rootPath !== null) {
      rootPathTest = rootPath
    } else {
      rootPathTest = this.#rootDir
    }
    if (rootPathTest !== null) {
      try {
        stats = await fs.stat(rootPathTest)
      } catch (e) {
        warn(e)
        warn(`Expected blog root dir is missing: ${rootPathTest}`)
        // throw new Error(e)
        return false
      }
      info('rootDir is directory: ', stats.isDirectory())
      return stats.isDirectory()
    }
    const p = path.parse(this.#blogDir)
    if (p.dir !== '') {
      info('p.dir: ', p.dir)
      this.#rootDir = p.dir
      return true
    }
    return false
  }

  /**
   * Make the album root directory if it doesn't already exist.
   * @summary Make the album root directory if it doesn't already exist.
   * @async
   * @param { string } dirPath - A string with the file system path to root dir location.
   * @throws Error If fails to make new directory at rootDir path.
   * @return { string } The path of the newly created rootDir.
   */
  async #makeRootDir(dirPath) {
    const log = _log.extend('makeRootDir')
    const info = _info.extend('makeRootDir')
    const error = _error.extend('makeRootDir')
    let dir
    try {
      info(`rootDir: ${this.#rootDir} ?= dirPath: ${path.resolve(dirPath)}`)
      dir = await fs.mkdir(path.resolve(dirPath), { recursive: true })
      log(dir)
      if (!dir) {
        return false
      }
    } catch (e) {
      error(e)
      throw new Error(e)
    }
    return dir
  }

  /**
   * Provide an async iterator of the album directory.
   * @summary Provide an async iterator of the album directory.
   * @async
   * @throws Error If album directory doesn't exist.
   * @return { fs.Dirent } AsyncIterator of the fs.Dirent
   */
  async #dir() {
    const log = _log.extend('dir')
    const error = _error.extend('dir')
    try {
      log(`Opening blog dir: ${this.#blogDir}`)
      const dirIt = await fs.opendir(this.#blogDir, { encoding: 'utf8', bufferSize: 32, recursive: true })
      return dirIt
    } catch (e) {
      error(`Error: ${this.#blogDir}`)
      throw new Error(e)
    }
  }

  /**
   * Provide a public interface to an iteratable directory read handle.
   * @summary Provide a public interface to an interable directory read handle.
   * @async
   * @retuun { fs.Dir|null} - AsyncIterator of fs.Dir instance.  */
  async next() {
    if (this.#directoryIterator) {
      return this.#directoryIterator.read()
    }
    return null
  }

  /**
   * Add a new image to the gallery.
   * @summary Add a new image to the gallery.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Object } newImage - An object containing new image to be added to the gallery.
   * @param { String } newImage.name - The name of the new image.
   * @throws { Error } - Throws an error for any async method.
   * @return { Object } result - Details of new image, sizes, urls, etc.
   */
  async addImage(newImage) {
    const log = _log.extend('newImage')
    const error = _error.extend('newImage')
    const result = {}
    log(`Adding new image to the gallery: ${newImage}`)
    if (!newImage) {
      const err = 'Missing required image.'
      error(err)
      return false
    }
    let exiftool
    let metadata
    let image
    try {
      exiftool = await new Exiftool().init(newImage)
    } catch (e) {
      error(`Failed to init exiftool with ${newImage}`)
      error(e)
    }
    try {
      exiftool.enableBinaryTagOutput(true)
      metadata = await exiftool.getMetadata('', null, '-File:FileName -IPTC:ObjectName -MWG:all -preview:all -Composite:ImageSize')
      log(metadata);
      [image] = metadata
    } catch (e) {
      const err = `Failed to get metadata for  ${newImage}`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    const img = image['File:FileName']
    const imageUrl = (this.#albumImageUrl) ? `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${img}` : ''
    let thumbName
    let thumbUrl
    if (image?.['EXIF:ThumbnailImage']) {
      const sourceParts = path.parse(imageUrl)
      thumbName = `${sourceParts.name}_thumbnail${sourceParts.ext}`
      const thumbPath = `${sourceParts.dir}/${thumbName}`
      const fullThumbPath = path.resolve('public', thumbPath)
      // log('thumb full path: ', fullThumbPath)
      thumbUrl = `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${thumbName}`
      log(`thumbUrl: ${thumbUrl} \n`)
      const buffer = Buffer.from(image['EXIF:ThumbnailImage'].slice(7), 'base64')
      try {
        await fs.writeFile(fullThumbPath, buffer)
      } catch (e) {
        const err = `Failed to create thumbnail image for ${image.SourceFile}\n`
                  + `save path: ${fullThumbPath}`
        error(err)
        error(e)
        throw new Error(err, { cause: e })
      }
    }
    let keywords
    log('keywords array? ', Array.isArray(image?.['Composite:Keywords']))
    if (image?.['Composite:Keywords']) {
      if (Array.isArray(image['Composite:Keywords'])) {
        keywords = image['Composite:Keywords']
      } else {
        keywords = [image['Composite:Keywords']]
      }
    }
    log('keywords array? ', Array.isArray(keywords))
    const tempImage = {
      name: img,
      url: imageUrl,
      big: null,
      med: null,
      sml: null,
      thumbnail: thumbUrl,
      title: image?.['IPTC:ObjectName'] ?? image?.['XMP:Title'],
      // keywords: image?.['Composite:Keywords'] ?? [],
      keywords: keywords ?? [],
      description: image?.['Composite:Description'],
      creator: image?.['Composite:Creator'] ?? this.#blogOwner,
      hide: false,
    }
    log('tempImage: %o', tempImage)
    result.title = tempImage.title
    result.keywords = tempImage.keywords
    result.description = tempImage.description
    this.#images.push(tempImage)
    let makeThumb = false
    if (!tempImage.thumbnail) {
      makeThumb = true
    }
    let sizes
    try {
      sizes = await this.generateSizes(img, makeThumb)
      result.sizes = sizes
    } catch (e) {
      const err = `Failed to create image sizes for ${newImage}`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    try {
      await this.save()
    } catch (e) {
      const err = `Failed to save changes to gallery after adding ${img}`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    log(result)
    return result
  }

  /**
   * Update saved details about an image, including committing changes into metadata.
   * @summary Update saved details about an image, including committing changes into metadata.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Object } image=null - An object literal containing image details to update.
   * @param { string } image.name - The name of the image to update.
   * @param { string } [image.title] - The new title of the image.
   * @param { string } [image.description] - The new description of the image.
   * @param { string[] } [image.keywords] - An array of keywords for the image.
   * @param { Boolean } [image.hide] - Hide of show image in gallery.
   * @param { Object } [image.resize] - An object literal containing size to resize image to.
   * @param { Number } [image.resize.w] - Resize width.
   * @param { Number } [image.resize.h] - Resize height.
   * @param { String } [image.rotate] - Rotate the image by the given number of degress.
   * @param { Boolean } [remakeThumbs] - Force remaking thumbnail images.
   * @return { Object|Boolean } - ...
   */
  async updateImage(image = null, remakeThumbs = false) {
    const log = _log.extend('updateImage')
    const error = _error.extend('updateImage')
    const result = {}
    let newThumbs = false
    let exiftool
    log(image)
    if (!image) {
      result.error = 'Missing required parameter: image.'
      error(result.error)
      return result
    }
    const index = this.#images.findIndex((i) => i.name === image.name)
    if (index === -1) {
      result.message = `${image.name} not found in this blog.`
      log(result.message)
      return result
    }
    const tagArray = []
    if (image?.title) {
      tagArray.push(`-XMP:Title="${image.title}"`)
      tagArray.push(`-IPTC:ObjectName="${image.title}"`)
    }
    if (image?.description) {
      tagArray.push(`-MWG:Description="${image.description}"`)
    }
    if (image?.keywords) {
      tagArray.push(`-MWG:Keywords="${image.keywords.join(', ')}"`)
    }
    const theImage = path.resolve(`${this.#blogDir}/${image.name}`)
    log(`The image to update: ${theImage}`)
    log('tags to be updated:', tagArray)
    // If no tagArray is empty, no metadata update necessary
    if (tagArray.length < 0) {
      // log(tagArray.join(' '))
      try {
        exiftool = await new Exiftool().init(theImage)
        exiftool.setOverwriteOriginal(true)
        result.metadata = await exiftool.writeMetadataToTag(tagArray)
        delete result.metadata.command
        if (image?.title) {
          this.#images[index].title = image.title
        }
        if (image?.description) {
          this.#images[index].description = image.description
        }
        if (image?.keywords) {
          this.#images[index].keywords = image.keywords
        }
        newThumbs = true
      } catch (e) {
        const err = `Failed to update metadata for image: ${theImage}`
        result.error = err
        error(err)
        error(result)
        error(e)
      }
    }
    this.#images[index].hide = image.hide
    try {
      if (image?.rotate) {
        await this.rotateImage(theImage, image.rotate)
        // this.rotateImage(theImage, image.rotate)
        newThumbs = true
      }
    } catch (e) {
      error(e.message)
      const msg = `Image Magick failed to rotate image: ${theImage}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      if (image?.resize) {
        // TODO: create resizeImage() method
        // await this.resizeImage(image.resize)
        // newThumbs = true // maybe
      }
    } catch (e) {
      const msg = `Image Magick failed up resize image: ${theImage}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      log(`remakeThumbs: ${remakeThumbs}, newThumbs: ${newThumbs}`)
      if (remakeThumbs || newThumbs) {
        const sizes = await this.generateSizes(image.name, remakeThumbs)
        // const sizes = this.generateSizes(image.name, remakeThumbs)
        result.sizes = sizes
        log(sizes)
      }
    } catch (e) {
      const msg = `Image Magick failed to regenerate the image sizes for: ${image.name}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      result.save = await this.save()
    } catch (e) {
      const err = 'Failed to save changes to db.'
      result.error += `\n${err}`
      error(err)
      error(result)
      error(e)
    }
    return result
  }

  /*
   * Extract the metadata from the images in the album.
   * @summary Extract the metadata from the images in the album.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Oject|Boolean } - The extracted metadata in JSON format, or false if no images found.
   */
  async getMetadata() {
    const log = _log.extend('getMetadata')
    const error = _error.extend('getMetadata')
    if (this.#images.length < 1) {
      return false
    }
    if (this.#images[0]?.url === undefined) {
      const tempImagesArray = []
      const exiftool = await new Exiftool().init(this.#blogDir)
      exiftool.enableBinaryTagOutput(true)
      this._metadata = await exiftool.getMetadata('', null, '-File:FileName -IPTC:ObjectName -MWG:all -preview:all -Composite:ImageSize')
      /* eslint-disable-next-line */
      for await (const img of this.#images) {
        const image = this._metadata.find((m) => m['File:FileName'] === img) ?? {}
        if (image) {
          // log(`this.#albumImageUrl: ${this.#albumImageUrl}`)
          const imageUrl = (this.#albumImageUrl) ? `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${img}` : ''
          log(`imageUrl: ${imageUrl}`)
          let thumbName
          let thumbUrl
          if (image?.['EXIF:ThumbnailImage']) {
            // log('has thumbnail data')
            const sourceParts = path.parse(imageUrl)
            thumbName = `${sourceParts.name}_thumbnail${sourceParts.ext}`
            const thumbPath = `${sourceParts.dir}/${thumbName}`
            const fullThumbPath = path.resolve('public', thumbPath)
            // log('thumb full path: ', fullThumbPath)
            thumbUrl = `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${thumbName}`
            log(`thumbUrl: ${thumbUrl} \n`)
            const buffer = Buffer.from(image['EXIF:ThumbnailImage'].slice(7), 'base64')
            try {
              await fs.writeFile(fullThumbPath, buffer)
            } catch (e) {
              error(`Failed to create thumbnail image for ${image.SourceFile}`)
              error(`save path: ${fullThumbPath}`)
              error(e)
            }
          }
          tempImagesArray.push({
            name: img,
            url: imageUrl,
            big: imageUrl,
            med: null,
            sml: null,
            // size: image?.['Composite:ImageSize'] ?? null,
            thumbnail: thumbUrl,
            title: image?.['IPTC:ObjectName'] ?? image?.['XMP:Title'],
            keywords: image?.['Composite:Keywords'] ?? [],
            description: image?.['Composite:Description'],
            creator: image?.['Composite:Creator'] ?? this.#blogOwner,
            hide: false,
          })
          log('tempImagesArray: %o', tempImagesArray)
        }
        this.#images = tempImagesArray
      }
    }
    return this._metadata
  }

  /**
   * Generate the various sizes plus a thumbnail for an image.
   * @summary Generate the various sizes plus a thumbnail for an image.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { String } image - A string name value of an image to create a thumbnail of.
   * @param { Boolean } remakeThumbs - If true, force remaking thumbnail images.
   * @return { undefined }
   */
  async generateSizes(image, remakeThumbs) {
  // generateSizes(image, remakeThumbs) {
    const log = this.#log.extend('generateSizes')
    const error = this.#error.extend('generateSizes')
    const imageUrl = (this.#albumImageUrl) ? `${this.#albumImageUrl}${(this.#albumImageUrl.slice(-1) !== '/') ? '/' : ''}${image}` : ''
    log(`imageUrl: ${imageUrl}`)
    let newJpegBig
    let newJpegMed
    let newJpegSml
    let big
    let med
    let sml
    let thb
    let orientation
    const magick = new Magick.Image()
    const parts = path.parse(image)
    log(parts)
    const original = `${this.#blogDir}/${image}`
    let format
    try {
      log(`opening ${original} in Image Magick`)
      await magick.readAsync(original)
      // magick.read(original)
      // const geometry = await magick.sizeAsync()
      const geometry = magick.size()
      if (geometry.width() > geometry.height()) {
        orientation = 'landscape'
        newJpegBig = `${parts.name}_${LANDSCAPE_BIG}.jpg`
        big = LANDSCAPE_BIG
        newJpegMed = `${parts.name}_${LANDSCAPE_MED}.jpg`
        med = LANDSCAPE_MED
        newJpegSml = `${parts.name}_${LANDSCAPE_SML}.jpg`
        sml = LANDSCAPE_SML
      } else {
        orientation = 'portrait'
        newJpegBig = `${parts.name}_${PORTRAIT_BIG}.jpg`
        big = PORTRAIT_BIG
        newJpegMed = `${parts.name}_${PORTRAIT_MED}.jpg`
        med = PORTRAIT_MED
        newJpegSml = `${parts.name}_${PORTRAIT_SML}.jpg`
        sml = PORTRAIT_SML
      }
      thb = `${parts.name}_thumbnail.jpg`
      log(`Image geometry is: ${geometry.toString()}, ${orientation}`)
    } catch (e) {
      const msg = `Image Magick failed to open image: ${original}`
      error(msg)
      throw new Error(msg, { cause: e })
    }
    try {
      // format = await magick.magickAsync()
      format = magick.magick()
      log(`Image file format: ${format}`)
    } catch (e) {
      const msg = 'Image Magick failed to get image file format.'
      throw new Error(msg, { cause: e })
    }
    if (!['jpeg', 'jpg', 'png'].includes(format.toLowerCase())) {
      try {
        log('convert file format to JPG')
        await magick.magick('jpg')
        // magick.magick('jpg')
      } catch (e) {
        const msg = 'image Magick failed to convert to JPG.'
        throw new Error(msg, { cause: e })
      }
    }
    const theImage = this.#images.find((i) => i.name === image)
    log('theImage: ', theImage)
    let b
    try {
      log(`resizing to ${big}, ${orientation}`)
      await magick.resizeAsync(big)
      // magick.resize(big)
    } catch (e) {
      const msg = `Imaged Magick failed to resize (${big}) ${b}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    try {
      b = path.join(this.#blogDir, newJpegBig)
      log('b: ', b)
      await magick.writeAsync(b)
      // magick.write(b)
      theImage.big = path.join(this.#albumImageUrl, newJpegBig)
    } catch (e) {
      const msg = `Imaged Magick failed to save ${b}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    let m
    try {
      log(`resizing to ${med}, ${orientation}`)
      await magick.resizeAsync(med)
      // magick.resize(med)
    } catch (e) {
      const msg = `Imaged Magick failed to resize (${med}) ${m}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    try {
      m = path.join(this.#blogDir, newJpegMed)
      log('m: ', m)
      await magick.writeAsync(m)
      // magick.write(m)
      theImage.med = path.join(this.#albumImageUrl, newJpegMed)
    } catch (e) {
      const msg = `Imaged Magick failed to save ${m}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    let s
    try {
      log(`resizing to ${sml}, ${orientation}`)
      await magick.resizeAsync(sml)
      // magick.resize(sml)
    } catch (e) {
      const msg = `Imaged Magick failed to resize (${sml}) ${s}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    try {
      s = path.join(this.#blogDir, newJpegSml)
      log('s: ', s)
      await magick.writeAsync(s)
      // magick.write(s)
      theImage.sml = path.join(this.#albumImageUrl, newJpegSml)
    } catch (e) {
      const msg = `Imaged Magick failed to save ${s}.`
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    if (!theImage.thumbnail || remakeThumbs) {
      let t
      try {
        log(`creating thumbnail (${THUMBNAIL})`)
        await magick.stripAsync()
        await magick.resizeAsync(THUMBNAIL)
        // agick.strip()
        // agick.resize(THUMBNAIL)
      } catch (e) {
        const msg = `Imaged Magick failed to resize (${THUMBNAIL}) ${t}.`
        error(msg)
        error(e)
        throw new Error(msg, { cause: e })
      }
      try {
        t = path.join(this.#blogDir, thb)
        log('t: ', t)
        // magick.write(t)
        await magick.writeAsync(t)
        theImage.thumbnail = path.join(this.#albumImageUrl, thb)
      } catch (e) {
        const msg = `Imaged Magick failed to save ${t}.`
        error(msg)
        error(e)
        throw new Error(msg, { cause: e })
      }
    }
    return {
      big: theImage.big,
      med: theImage.med,
      sml: theImage.sml,
      thb: theImage.thumbnail,
    }
  }

  /**
   * Rotate an image by the given number of degrees.
   * @summary Rotate an image by the given number of degrees.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { String } imageName - The name of the image to be rotated.
   * @param { Number } degrees - The number of degrees to rotate the image, counter-clockwise.
   * @return { undefined }
   */
  async rotateImage(imageName, degrees) {
    const log = this.#log.extend('rotateImage')
    const error = this.#error.extend('rotateImage')
    const imagePath = imageName
    log(`imagePath: ${imagePath}`)
    const deg = Number.parseInt(degrees, 10)
    log(`typeof deg: ${typeof deg}, value: ${deg}`)
    const magick = new Magick.Image()
    try {
      await magick.readAsync(imagePath)
      // magick.read(imagePath)
    } catch (e) {
      const err = `magick.readAsync(${imagePath}) failed to open image.`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    try {
      const rotated = await magick.rotateAsync(deg)
      // const rotated = magick.rotate(Number.parseInt(deg, 10))
      log(`Image Magick rotated ${imagePath} by ${deg} degrees (${rotated})`)
    } catch (e) {
      const err = `magick.rotateAsync(${deg}) failed to rotate ${deg} deg image: ${imagePath}`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    try {
      // TODO: something, something, something... dark siiiiiide...
      // magickwand.js can't encode (save) .HEIC files... so this causes
      // rotating image form widget to fail if original file is .HEIC
      // Need to think of something to do here.
      await magick.writeAsync(imagePath)
      // magick.write(imagePath)
    } catch (e) {
      const err = `magick.writeAsync(${imagePath}) failed to save rotated image.`
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
  }

  /**
   * Build the JSON object for the album.
   * @summary Build the JSON object for the album.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @throws Error
   * @return { Object }
   */
  async createAlbumJson() {
    return {
      _id: this.#blogId,
      dir: this.#blogDir,
      imageUrl: this.#albumImageUrl,
      creator: this.#blogOwner,
      name: this.#blogName,
      url: this.#blogUrl,
      description: this.#blogDescription,
      keywords: Array.from(this.#blogKeywords),
      public: this._blogPublic,
      images: this.#images,
    }
  }

  set redisClient(client) {
    this.#redis = client
  }

  set mongoClient(client) {
    this.#mongo = client
  }

  set rootDir(noop) {
    this.#error('No-op')
  }

  get rootDir() {
    return this.#rootDir
  }

  async setRootDir(dirPath) {
    const log = this.#log.extend('setRootDir')
    const error = this.#error.extend('setRootDir')
    log('         dirPath: ', dirPath)
    log('resolved dirPath: ', path.resolve(dirPath))
    let root
    const exists = await this.#checkRootDirExists(dirPath)
    log(`root dir exists: ${exists}`)
    if (exists) {
      log(`${dirPath} exists and setting as new rootDir`)
      this.#rootDir = dirPath
    } else {
      log('no root dir yet.')
      root = await this.#makeRootDir(dirPath)
      if (!root) {
        error('mkdir failed')
        throw new Error(`Failed to make album root dir: ${dirPath}`)
      } else {
        this.#rootDir = root
        log(this.#rootDir)
      }
    }
    return this.init()
  }

  addKeyword(word) {
    return Array.from(this.#blogKeywords.add(word))
  }

  removeKeyword(word) {
    return this.#blogKeywords.delete(word)
  }

  get id() {
    if (this.#blogId) {
      return this.#blogId
    }
    return undefined
  }

  set id(id) {
    this.#blogId = id
  }

  get blogDir() {
    return this.#blogDir
  }

  set blogDir(blogDirPath) {
    this.#blogDir = blogDirPath
    this.#resolveAlbumDirPath()
  }

  get url() {
    return this.#blogUrl
  }

  set url(url) {
    this.#blogUrl = url
  }

  get images() {
    return this.#images
  }

  set previewImage(url) {
    this.#albumPreviewImage = url
  }

  get previewImage() {
    return this.#albumPreviewImage
  }

  get name() {
    return this.#blogName
  }

  set name(name) {
    this.#blogName = name
  }

  get owner() {
    return this.#blogOwner
  }

  set owner(owner) {
    this.#blogOwner = owner
  }

  set description(desc) {
    this.#blogDescription = desc
  }

  get description() {
    return this.#blogDescription
  }

  set keywords(words) {
    // console.log(words)
    words.forEach((word) => {
      this.#blogKeywords.add(word)
    })
  }

  get keywords() {
    console.log(this.#blogKeywords)
    return Array.from(this.#blogKeywords)
  }

  get public() {
    return this._blogPublic
  }

  set public(isPublic = false) {
    this._blogPublic = isPublic
  }

  async getJson() {
    if (this.#blogJson) {
      return this.#blogJson
    }
    return this.createBlogJson()
  }

  get json() {
    this.#error('no-op: get json()')
    return undefined
  }

  set json(j) {
    this.#error('no-op: set json()')
  }
}

export { Blog }
