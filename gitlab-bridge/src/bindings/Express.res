// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2026 Jonathan D.A. Jewell

/**
 * Bindings for Express.js
 */

// Core types
type request
type response
type nextFunction = unit => unit
type middleware = (request, response, nextFunction) => unit
type errorMiddleware = (JsExn.t, request, response, nextFunction) => unit
type app

// Create Express app
@module("express") external make: unit => app = "default"

// Request methods
// `getHeader` is a method call (`req.get("Header-Name")`), not a property
// read, so it uses `@send`, not `@get`. ReScript 12's stricter
// `@get`-attribute checking rejected the prior `@get` form (which had
// two arguments, only valid for `@send`).
@send external getHeader: (request, string) => option<string> = "get"
@get external getBody: request => JSON.t = "body"
@get external getParams: request => JSON.t = "params"
@get external getQuery: request => JSON.t = "query"
@get external getPath: request => string = "path"
@get external getMethod: request => string = "method"
@get external getIp: request => option<string> = "ip"

// Response methods
@send external status: (response, int) => response = "status"
@send external json: (response, JSON.t) => response = "json"
@send external send: (response, string) => response = "send"
@send external setHeader: (response, string, string) => response = "set"

// App methods
@send external use: (app, middleware) => unit = "use"
@send external useError: (app, errorMiddleware) => unit = "use"
@send external get: (app, string, middleware) => unit = "get"
@send external post: (app, string, middleware) => unit = "post"
@send external put: (app, string, middleware) => unit = "put"
@send external delete: (app, string, middleware) => unit = "delete"
@send external patch: (app, string, middleware) => unit = "patch"
@send external listen: (app, int, unit => unit) => unit = "listen"

// Middleware
@module("express") external jsonMiddleware: unit => middleware = "json"
@module("express") external urlencodedMiddleware: {..} => middleware = "urlencoded"

// Helper to create JSON success response
let sendSuccess = (res: response, ~data: JSON.t, ~statusCode=200, ()): response => {
  res->status(statusCode)->json(data)
}

// Helper to create JSON error response
let sendError = (res: response, ~message: string, ~statusCode=500, ()): response => {
  // ReScript 12 / @rescript/core: JSON helpers moved to JSON.Encode;
  // `object_` → `object`; no top-level `number` (use `int`/`float`).
  let error = JSON.Encode.object(
    Dict.fromArray([
      ("error", JSON.Encode.string(message)),
      ("status", JSON.Encode.int(statusCode)),
    ]),
  )
  res->status(statusCode)->json(error)
}
