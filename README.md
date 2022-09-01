## tdl &nbsp; [![npm](https://img.shields.io/npm/v/tdl.svg)](https://www.npmjs.com/package/tdl) [![CI](https://github.com/Bannerets/tdl/actions/workflows/ci.yml/badge.svg)](https://github.com/Bannerets/tdl/actions/workflows/ci.yml)

`tdl` is a JavaScript wrapper for [TDLib][] (Telegram Database library),
a library to create [Telegram][] clients or bots.<br>
TDLib version 1.5.0 or newer is required.

[TDLib]: https://github.com/tdlib/td
[Telegram]: https://telegram.org/

### Table of Contents

- [Installation](#installation)
- [Requirements](#requirements)
- [API](#api)
- [Examples](#examples)
- [Log in as a bot](#log-in-as-a-bot)
- [Options](#options)
- [Typings](#typings)
- [Creating multiple clients](#creating-multiple-clients)
- [WebAssembly](#webassembly)
- [Using on Windows](#using-on-windows)
- [Possible errors](#possible-errors)

---

<a name="installation"></a>
### Installation

1. Build TDLib (https://github.com/tdlib/td#building)
2. `npm install tdl tdl-tdlib-addon` &nbsp;(install both)
3. `npm install --save-dev tdlib-types` if you use Flow or TypeScript &nbsp;(recommended)

Instead of building TDLib, you can try to use third-party pre-built binaries,
but those may depend on different versions of shared libraries:

- [tdlib.native](https://github.com/ForNeVeR/tdlib.native/releases)

---

<a name="requirements"></a>
### Requirements

- Node.js v10+
- A C++ compiler and Python installed
- The tdjson shared library (`libtdjson.so` on Linux, `libtdjson.dylib` on macOS, `tdjson.dll` on Windows)

The shared library should be installed in your system (present in the search paths).

---

<a name="api"></a>
### API

#### `new Client(tdlibInstance, options) => Client`

```javascript
// Example in Node.js:
const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

const client = new Client(new TDLib(), {
  apiId: 2222, // Your api_id
  apiHash: '0123456789abcdef0123456789abcdef', // Your api_hash
})
```

`api_id` and `api_hash` can be obtained at https://my.telegram.org/.

The path to `libtdjson` can be optionally specified in the `TDLib` constructor's
argument (e.g., `new TDLib('libtdjon.so')`). It is directly passed to
[`dlopen`][dlopen] / [`LoadLibrary`][LoadLibraryW]. Check your OS documentation
to see where it searches for a shared library.

The `Options` interface is described in [#options](#options).

#### `client.connect() => Promise<undefined>`

Initialize the client and pass the options to TDLib.
This function (or `client.connectAndLogin`) should be called after creating a `Client`.
Returns a promise.

```javascript
await client.connect()
```

#### `client.login(fn?: () => LoginDetails) => Promise<undefined>`

Log in to the Telegram account.

```javascript
await client.login()
```

By default, `tdl` asks the user for the phone number, auth code, and 2FA
password (if specified) in the console. You can pass custom functions:

```javascript
// Example
await client.login(() => ({
  getPhoneNumber: retry => retry
    ? Promise.reject('Invalid phone number')
    : Promise.resolve('+9996620001'),
  getAuthCode: retry => retry
    ? Promise.reject('Invalid auth code')
    : Promise.resolve('22222'),
  getPassword: (passwordHint, retry) => retry
    ? Promise.reject('Invalid password')
    : Promise.resolve('abcdef'),
  getName: () =>
    Promise.resolve({ firstName: 'John', lastName: 'Doe' })
}))
```

The `getName` function is called if the user is not signed up.

It is possible (and advisable for larger apps) not to use the `client.login`
helper and implement the authorization process manually, handling
`authorizationStateWaitPhoneNumber` and other updates. This function supports
logging in via phone number only. Some other methods like QR code are also
available on Telegram.

The function accepts the following interface:

```typescript
type LoginDetails = {
  type?: 'user',
  getPhoneNumber?: (retry?: boolean) => Promise<string>,
  getAuthCode?: (retry?: boolean) => Promise<string>,
  getPassword?: (passwordHint: string, retry?: boolean) => Promise<string>,
  getName?: () => Promise<{ firstName: string, lastName?: string }>
} | {
  type: 'bot',
  getToken: (retry?: boolean) => Promise<string>
}
// Note that client.login accepts a function that returns the object, not the
// object directly. The function will not be called if the client is already
// authorized.
declare function login (fn?: () => LoginDetails): Promise<undefined>
```

#### `client.connectAndLogin(fn?: () => LoginDetails) => Promise<undefined>`

Same as `client.connect().then(() => client.login(fn))`.

```javascript
await client.connectAndLogin()
```

#### `client.on(event: string, callback: Function) => Client`

Attach an event listener to receive updates.

```javascript
function onUpdate (update) {
  console.log('New update:', update)
}
client.on('update', onUpdate)
client.on('error', console.error)
```

Ideally, you should always have a listener on `client.on('error')`.
There is no default listener, all errors will be ignored otherwise.

You can consider using reactive libraries like RxJS or [most][] for convenient event processing.

`client.addListener` is an alias to this function.

[most]: https://github.com/cujojs/most

#### `client.once(event: string, callback: Function) => Client`

Attach a one-time listener.

#### `client.off(event: string, listener: Function, once?: boolean) => Client`

Remove an event listener.

```javascript
const listener = v => {
  console.log('New update:', v)
  client.off('update', listener) // Removes the listener
}
client.on('update', listener)
```

`client.removeListener` is an alias to this function.

#### `client.invoke(query: Object) => Promise<Object>`

Asynchronously call a TDLib method.
Returns a promise, which resolves with the response or rejects with an error.

The API list can be found at https://core.telegram.org/tdlib/docs/annotated.html
or in the [td_api.tl][] file.
In the tl file, the `byte` type means you should pass a **base64-encoded** string. For `int64`, it is possible to pass either a number or string, pass string for large numbers.<br>
Note that the TDLib JSON interface actually sends a `@type` field, but `tdl` renames it to `_`.

[td_api.tl]: https://github.com/tdlib/td/blob/v1.8.0/td/generate/scheme/td_api.tl

```javascript
const chats = await client.invoke({
  _: 'getChats',
  chat_list: { _: 'chatListMain' },
  limit: 4000
})
```

```javascript
await client.invoke({
  _: 'sendMessage',
  chat_id: 123456789,
  input_message_content: {
    _: 'inputMessageText',
    text: {
      _: 'formattedText',
      text: '👻'
    }
  }
})
```

#### `client.execute(query: Object) => (Object | null)`

Synchronously call a TDLib method and receive a response. This function can be
called only with the methods marked as "can be called synchronously" in the
TDLib documentation.

```javascript
const res = client.execute({
  _: 'getTextEntities',
  text: '@telegram /test_command https://telegram.org telegram.me'
})
```

#### `client.close() => Promise<undefined>`

Close the TDLib instance.

This function sends `client.invoke({ _: 'close' })` and waits until the client
gets destroyed.

```javascript
await client.close()
```

#### `client.setLogFatalErrorCallback(fn: (null | Function)) => undefined`

Set the callback that will be called when a fatal error happens in TDLib.

See this function in the [TDLib documentation](https://core.telegram.org/tdlib/docs/td__log_8h.html#a6b2d796393f3eb6fb3c764b69c1588b5).

```javascript
client.setLogFatalErrorCallback(errorMessage => {
  console.error('Fatal error:', errorMessage)
})
```

---

<a name="examples"></a>
### Examples

```javascript
const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

const client = new Client(new TDLib(), {
  apiId: 2222, // Your api_id, get it at http://my.telegram.org/
  apiHash: '0123456789abcdef0123456789abcdef' // Your api_hash
})

client.on('error', console.error)
client.on('update', update => {
  console.log('Received update:', update)
})

async function main () {
  await client.connectAndLogin()

  console.log(await client.invoke({ _: 'getMe' }))
}

main()
```

See the [examples/](examples/) directory.

---

<a name="log-in-as-a-bot"></a>
### Log in as a bot

```javascript
const client = new Client(new TDLib(), {
  apiId: 2222, // Your api_id
  apiHash: '0123456789abcdef0123456789abcdef' // Your api_hash
})

await client.connectAndLogin(() => ({
  type: 'bot',
  getToken: retry => retry
    ? Promise.reject('Invalid bot token')
    : Promise.resolve('YOUR_BOT_TOKEN') // Enter your token from @BotFather
}))
```

---

<a name="options"></a>
### Options

```typescript
// The interface of the options passed to the Client constructor:
type Options = {
  apiId: number, // Can be obtained at https://my.telegram.org
  apiHash: string, // Can be obtained at https://my.telegram.org
  databaseDirectory: string, // Relative path (default is '_td_database')
  filesDirectory: string, // Relative path (default is '_td_files')
  databaseEncryptionKey: string, // Optional key for database encryption
  verbosityLevel: number, // Verbosity level (default is 2)
  useTestDc: boolean, // Use test telegram server (default is false)
  tdlibParameters: Object, // Raw TDLib parameters
  // Advanced options:
  skipOldUpdates: boolean, // Don't emit updates when connectionStateUpdating
  receiveTimeout: number,
  useMutableRename: boolean,
  useDefaultVerbosityLevel: boolean,
  disableAuth: boolean
}
```

Only `apiId` and `apiHash` are required fields. Any other field can be omitted.

See https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1tdlib_parameters.html
for the parameters that can be specified in the `tdlibParameters` option.

The default `tdlibParameters` are:

```javascript
tdlibParameters: {
  use_message_database: true,
  use_secret_chats: false,
  system_language_code: 'en',
  application_version: '1.0',
  device_model: 'Unknown device',
  system_version: 'Unknown',
  enable_storage_optimizer: true,
  api_id: options.apiId,
  api_hash: options.apiHash,
  database_directory: options.databaseDirectory,
  files_directory: options.filesDirectory,
  use_test_dc: options.useTestDc
}
```

---

<a name="typings"></a>
### Typings

`tdl` fully supports [TypeScript][] and [Flow][].
`tdlib-types` should be installed to use the typings.

The TDLib types can be imported using:

```typescript
import type { message as Td$message, user /* ... */ } from 'tdlib-types'
```

Or import all types at once:

```typescript
import * as Td from 'tdlib-types'
// Use as: Td.message, Td.user, ...
```

The latest available typings are for TDLib v1.8.0.

You can install typings for other TDLib versions using `npm install -D tdlib-types@td-<TDLIB_VERSION>`.
For example, to install typings for TDLib v1.7.0, run `npm install -D tdlib-types@td-1.7.0`.

It is much more convenient to use `tdl` with the TypeScript types, which
enables full autocompletion for the TDLib methods and objects.

See also [packages/tdlib-types/README.md](packages/tdlib-types/README.md).

[TypeScript]: https://www.typescriptlang.org/
[Flow]: https://flow.org/

---

<a name="creating-multiple-clients"></a>
### Creating multiple clients

`tdl-tdlib-addon` allows you to create multiple clients, but currently the number of created clients should not exceed [UV_THREADPOOL_SIZE](http://docs.libuv.org/en/v1.x/threadpool.html).

---

<a name="webassembly"></a>
### WebAssembly

`tdl` also has an [experimental wrapper](packages/tdl-tdlib-wasm/) for TDLib compiled to WebAssembly.
To use it, install `tdl-tdlib-wasm` instead of `tdl-tdlib-addon`. It works in the browser only.

---

In the repository, there is also an older package `tdl-tdlib-ffi` (_now deprecated_) for Node.js,
which uses `node-ffi-napi` instead of a custom node addon. Note that `tdl-tdlib-ffi` does not allow to create multiple clients, that will result in use-after-free. One advantage of using `ffi-napi` might be the availability of prebuilt binaries for the node addon.

The library is designed to work with different "backends", which all follow the same interface
described in the [TDLib_API.md](TDLib_API.md) file (the types are described in the `tdl-shared` package),
so it is possible to easily swap one with another. The `tdl` package itself is platform-independent. Currently, the present "backends" are `tdl-tdlib-addon` (recommended), `tdl-tdlib-ffi` (deprecated), `tdl-tdlib-wasm` (experimental).

---

<a name="using-on-windows"></a>
### Using on Windows

The library depends on node-gyp, which may be difficult to install on Windows.
You should install Visual Studio (or just Build Tools) and Python first.
For example, see https://gist.github.com/jtrefry/fd0ea70a89e2c3b7779c,
https://github.com/Microsoft/nodejs-guidelines/blob/dd5074c/windows-environment.md#compiling-native-addon-modules.
There's also a [`windows-build-tools` package](https://github.com/felixrieseberg/windows-build-tools) on npm.

Otherwise, `tdl` works fine on Windows.

---

<a name="possible-errors"></a>
### Possible errors

- `UPDATE_APP_TO_LOGIN`

Update TDLib to v1.7.9 (v1.8.0) or newer. It is no longer possible to log in
using a phone number in older versions of TDLib.

- `Dynamic Loading Error: dlopen(…) image not found`
- `Dynamic Loading Error: Win32 error 126`

The tdjson shared library or one of its dependencies cannot be found. To
troubleshoot dependency issues, try to run `ldd libtdjson.so` on Linux or
`otool -L libtdjson.dylib` on macOS. On Windows, you can use an app like
Dependency Walker.

Recheck the documentation of [dlopen][] (Linux), [dlopen][dlopen-macos] (macOS),
[Dynamic-Link Library Search Order][dllso] (Windows) to make sure the shared
library is present in the search paths. By default, Linux does not search in the
current working directory, while macOS does.

[dllso]: https://docs.microsoft.com/en-us/windows/win32/dlls/dynamic-link-library-search-order#standard-search-order-for-desktop-applications
[dlopen-macos]: https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/dlopen.3.html

[dlopen]: https://www.man7.org/linux/man-pages/man3/dlopen.3.html
[LoadLibraryW]: https://docs.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibraryw

- `Error while reading RSA public key`

You can get this error if libtdjson is dynamically linked against OpenSSL and
some of the symbols got resolved to Node.js instead of the system OpenSSL.

Note that Node.js also uses OpenSSL (the distributed binaries are statically
linked against it) and _exports the OpenSSL symbols_. In the result, there are
two versions of OpenSSL in the same application. Then, using standard dlopen,
especially on Linux, most of the symbols will be resolved into libcrypto
inside the Node.js binary, not into the system libcrypto. It still can work
correctly if the versions are ABI-compatible, i.e. if TDLib is linked against an
OpenSSL version sufficiently similar to the version Node.js uses
(`node -p "process.versions.openssl"`).

`tdl` tries to get around the symbol conflict issues by using `RTLD_DEEPBIND`
when available, so these issues should be rare in practice.

You can check in `lldb` / `gdb` if the symbols get resolved into Node.js. For
example, open `lldb -- node index.js` and set these breakpoints:

```
break set -r EVP_ -s node
break set -r AES_ -s node
break set -r BIO_ -s node
break set -r RSA_ -s node
break set -r CRYPTO_ -s node
```

It's also possible to set breakpoints inside the system OpenSSL:

```
break set -r . -s libcrypto.so.1.1
break set -r . -s libssl.so.1.1
```

To solve this issue, try to link TDLib statically against OpenSSL (the
`OPENSSL_USE_STATIC_LIBS` option in cmake) or link it against the OpenSSL version
that Node.js uses.

Another possible option is to rebuild Node.js from source, linking it
dynamically against the same system OpenSSL. That way, there is only one
instance of OpenSSL in the application. For example, using [nvm][], you can
install Node.js v16 from source on GNU/Linux via this command:

```console
$ nvm install -s 16 --shared-openssl --shared-openssl-includes=/usr/include/ --shared-openssl-libpath=/usr/lib/x86_64-linux-gnu/
```

[nvm]: https://github.com/nvm-sh/nvm

However, it's inconvenient for most users to rebuild Node.js.

Another hypothetical solution is to rebuild TDLib with the OpenSSL headers
distributed in Node.js (`<path-to-node>/include/node/`) without linking it to
anything, simply leaving the undefined symbols. Using this option, there is also
only one OpenSSL. I haven't checked that this works or that Node exports all the
symbols needed for TDLib. With this option, TDLib also should be rebuilt every
time Node.js updates the OpenSSL dependency.

This issue doesn't apply to Electron because it doesn't export the OpenSSL
symbols.

- Segmentation fault

Most likely, the cause of this error is the same as above.
