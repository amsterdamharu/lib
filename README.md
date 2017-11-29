# lib
JavaScript library functions

### npm Scripts

    npm run test

Runs webpack dev server with `jasmine-webpack-plugin`, look at the output of the command for the url to open (should be: http://localhost:8080/_specRunner.html)

The scripts `start`,`build` and `debug` are not used.

### anyPromise
Resolves whatever promises resolves first and rejects if all promises reject with an array of rejected values in the same order as passed promises or rejects. Will also reject when an empty array or none array is passed.

Not all values in the array need to be promises but anyPromise will resolve with the first value that is not a promise if there are any.

examples:

```javascript
lib.anyPromise(
  promise1, //this will reject
  promise2 //this will resolve to the value of 2 in 2 seconds
  promise3, //this will resolve to the value of 1 in 1 second
)
.then(
  x => conole.log(x)// will log 1 since promise3 was the first to resolve
)
lib.anyPromise(
  promise1, //this will reject
  1,
  2
)
.then(
  x => conole.log(x)// will log 1 since that is the first none promise value (fasted to return)
)
lib.anyPromise(
  promise1, //this will reject with reason 1 in 2 seconds
  promise2, //this will reject with reason 2 in 1 second
)
.then(
  x => x // it will not resolve, all promises reject so anyPromise will reject
  ,reason => console.log(reason) // this will log [1,2] (order is same as array passed)
                                 //   not in order of rejection)
)
```

### throttle

Causes a promise returning function not to be called untill less than max are active.

Let's say you'd like to get 100 xhr requests but only want 10 connections to be active, you could do the following:

```javascript
max10 = lib.throttle(10);
Promise.all(
  urls.map(
    //Only 10 connections will be active because fetch is wrapped in max10
    //  do not re use max10 again for promises, create a new one if you want other
    //  sets of promises to be throttled
    //When an active connection becomes inactive (promise resolves or rejects) the
    //  next promise will be started.
    url => max10(fetch)(url).then(x=>x,err=>/** do something with the failed item */)
  )
)
.then(
  responses => //...
)

const max10 = lib.throttle(10);
const functions = [fn1,fn2,fn3...fn100];//functions returning promise
const params = [param1,param2,param3...param100];//parameter passed to function
const promises = 
  functions.map(
    (fn,index)=>
      //start 10 out of 100 functions and only start another if one of the 10 is finished
      max10(fn)(params[index])
      .then(...)
  )
;
```
### compose

Turns an array of functions `[fn1,fn2,fn3]` into:

`function(x) { return fn3(fn2(fn1(x))); }`

Both x or any of the results of the functions can be a promise. If it is a promse then the next function will be used as the resolve handler.

example:

```javascript
lib.compose([
  x=>x+1 //fn1
  ,x=>Promise.resolve(x+1) //fn2
  ,x=>x+2 //fn3
])
//this turns into a function that looks like this:
// x =>
//   fn2(fn1(x))
//     .then(fn3)
```

If the promse is rejected the next function is not called the handler for reject is called later down the promise chain

exaple:

```javascript
const composedFunction =
  lib.compose([
    x=>x+1 //fn1
    ,x=>Promise.reject("nooo") //fn2
    ,x=>console.log("I'm never called") //fn3
  ])
;
//this turns into a function that looks like this:
// x =>
//   fn2(fn1(x))
//     .then(fn3)
//You can see that fn3 is never called because it's the resolve handler of fn2
//  since fn2 returns a rejected promise the resolve handler (fn3) will never be called
composedFunction(22)
.then(
  x=>console.log("will not resolve because fn2 returns a rejected promise")
  ,err=>console.log(err)//will log "nooo" because that's the reject reason of fn2
)
```