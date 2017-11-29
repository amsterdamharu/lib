//not exported, checks if a value could be like promise
const promiseLike =
x =>
  (x!==undefined && typeof x.then === "function")
;

//not exported, if x is promise then fn is called with the
//  resolve of x
const ifPromise =
  (fn) =>
  (x) =>
    promiseLike(x)
      ?x.then(fn)
      :fn(x)
;
/**
 * takes time, error, function (fn) and argument (arg)
 * when fn(arg) returns a promise that does not resolve before
 * time (time is in milliseconds) then this function will return
 * a rejected promise with the reject reason of error (parameter error)
 * example:
 *    timedMyFunction = timedPromise
 *      (500)//times out in 500 milliseconds
 *      ("myFunction timed out.") //error if timed out
 *      (myFunction) //the function to call 
 *    // this will call myFunction("argument to myFunction")
 *    //   and will return a promise (even if myFunciton does not return a promise)
 *    //   if myFunction resolves within 500 millisends then the returned promise
 *    //   resolves to that value, if myFunction rejects within 500 milliseconds
 *    //   then the returned promise will reject with the reject reason of myFunction
 *    //   if myFunction takes longer than 500 milliseconds to resolve or reject
 *    //   then the returned promise will reject with the reject reason of 
 *    //      "myFunction timed out."
 *    timedMyFunction("argument to myFunction")
 *    .then(
 *      resolve => //continue, resolve is the return value of myFuntion
 *      ,reject => //handle reject, either myFunction failed or timed out
 *    )
 */
const timedPromise =
  (time) =>
  (error)  =>
  (fn) =>
  (arg)  => 
    queReject(
      Promise.race([
        queReject(Promise.resolve(arg).then(fn))
        ,queReject(
          new Promise(
            (resolve,reject) =>
              setTimeout(
                x=>reject(error)
                ,time
              )
          )
        )
      ])
    )
;
/**
 * Do not have node crash or browser console shout at you
 *   when rejecting a promise that will not be handled 
 *   by current stack but later in the message queue
 * For example:
 * const someReject = x => Promise.reject(x);
 * //this will have node crash and browser log Uncought in Promise
 * //  the promise rejection is handled but not in the current stack
 * //  the handler is in the message queue
 * const result = someReject(x);
 * //put the reject handler in the message queue
 * setTimeout(x => result.then(undefined,x=>x),10);
 */
const queReject =
  rejectValue => {
    const r = Promise.resolve(rejectValue);
    r.then(x=>x,x=>x);
    return r;
  }
;
/**
 * (result.Success|result.Failure)(value) 
 *   Success or Failure: should the object returned 
 * creates an object that has 3 members
 *   succeeded: true if created with result.Success false if created with result.Failure
 *   value: the value of the result
 *   error: this is undefined when type is Success and has the error
 *     or failure reason if the type is failure
 *  Usage example:
 *    //imagine a  synchronous function getUserById that returns a user or null
 *    //  if the user is not found. Instead of using null you can have it return
 *    //  a result that has a Success of User and Failure of "not found"
 *    const getUserById = id =>
 *      (id === 1) //imagine this is some sychronous action looking up the user from an array
 *        ? result.success({userName:"the user name"})
 *        : result.failure("User not found")
 *    const res = getUserById(22);
 *    if(res.succeeded !== true){
 *      //handle failure res.error
 *    } else {
 *      //handle success res.value
 *    }
 *  For asynchronous code you can use compose that takes a promise (see compose)
 */
const result = (
  ()=>{
    const SUCCESS = {}
    ,FAILURE = {}
    ,createResult = type => value =>
      (type !== SUCCESS)
        ? ({
            error:value,
            succeeded:false
          })
        : ({
            value:value
            ,succeeded:true
          })
    return {
      success:val=>createResult(SUCCESS)(val)
      ,failure:err=>createResult(FAILURE)(err)
    }
  }
)();
/**
 * 
 * convert a function (T->T) to (result T->result T)
 *  if a function takes a number and returns a number but could (for example)
 *  throw an exception you can lift this funciton to a function that takes a
 *  result of number and returns a result of number.
 * Usage example:
 * //function that takes a number and returns a number but throws if number passed is 1
 * const example = num => {
 *   console.log("num is:",num);
 *   if(num === 1){ throw "Cannot pass 1"; } else { return num+9; }
 * }
 * const tryProcessor = fn => val => {
 *   try {
 *     const res = fn(val);
 *     return result.success(res);
 *   } catch (e) {
 *     return result.failure(e);
 *   }
 * }
 * const tryResult = liftResult(tryProcessor)
 * const r = tryResult(example)(result.success(3));
 * //example that takes an id and returns a user or undefined when user is not found
 * const users = [{id:1,name:"Harry"}]
 * const getUser = id => users.filter(user=>user.id===id)[0]
 * const getUserProcessor = fn => val => {
 *   const r = fn(val);
 *   if(r !== undefined){ 
 *    return result.success(r); 
 *   } else {
 *    return result.failure("User not found"); 
 *   }
 * }
 * const userResultById = liftResult(getUserProcessor)(getUser);
 * const userResult = userResultById(result.success(1));
 * if(userResult.succeeded === true) { ... } else { ... }
 */
const liftResult = processor => fn => arg => {
  //do not call funcion if argument is of type Failure
  if(arg.succeeded !== true){
    return arg;
  }
  const initial = {};
  return processor(fn)(arg.value);
};

/**
* 
* takes 2 functions and turns it into:
* fn2(fn1(x)) when a value x is provided
* if x is a promse it will turn it into:
* x.then(x => fn2(fn1(x)))
* if fn1(x) is a promise it will turn it into:
* fn1(x).then(x => fn2(x))
* if both x and fn1(x) are promises:
* x.then(x => fn1(x)).then(x => fn2(x))
*/
const compose2 =
  fn1=>
  fn2=>
    x =>
      ifPromise
        (fn2)
        (
          ifPromise
            (fn1)
            (x)
        )
;

/**
turns an array of functions [fn1,fn2,fn3] into:
fn3(fn2(fn3(x)))
both x or any of the results of the functions can be a promise
If it is a promse then the next function will be called with
the resolve value of the promise.
If the promse is rejected the next function is not called
the handler for reject is called later down the promise chain
for example fn2 returns a rejected promise:
fn1(x)
.then(x => fn2(x))
.then(notCalled => fn3(notcalled))
.then(undefined,called)
*/
const compose =
  fns =>
    fns.reduce(
      (acc,fn) => compose2(acc)(fn)
      ,x=>x//id function
    )
;

/*
causes a promise returning function not to be called
untill less than max are active
usage example:
max2 = throttle(2);
functions = [fn1,fn2,fn3...fn100];//functions returning promise
params = [param1,param2,param3...param100]
Promise.all(//even though a 100 promises are created, only 2 are active
  functions.map(
    (fn,index)=>
      max2(fn)(params[index])
      .then(...)
  )
)
*/
const throttle =
  (max) =>{
    var que = [];
    var queIndex =-1;
    var running = 0;
    const wait = (resolve,fn,arg) => () =>
      resolve(ifPromise(fn)(arg));
    const nextInQue = ()=>{
      ++queIndex;
      if(typeof que[queIndex]==="function"){
        return que[queIndex]();
      }else{
        que=[];
        queIndex=-1;
        running = 0;
        return "Does not matter, not used";
      }
    };
    const queItem = (fn,arg)=>
      new Promise(
        (resolve,reject)=>que.push(wait(resolve,fn,arg))
      )
    ;
    return (fn)=>(arg)=>{
      const p = queItem(fn,arg)
        .then(x=>nextInQue() && x)
      ;
      running++;
      if(running<=max){
        nextInQue();
      }
      return p;
    };    
  }
;
/**
 * Resolves whatever promises resolves first and rejects if all promises reject
 * with an array of rejected values in the same order as passed promises
 * or rejects when an empty array is passed
 * Not all values in the array need to be promises but anyPromise will resolve
 * with the first value that is not a promise if there are any.
 * @param {Any[]} promises 
 * @returns {Promise.<Any>}
 */
const anyPromise = (promises) =>{
  let rec = (promises,rejected) => 
    (promises.length === 0)
      ? queReject(Promise.reject(rejected))
      : Promise.race(
          promises.map(
            ([p,orgIndex],index) =>
              queReject(
                new Promise(
                  (resolve,reject) =>
                    p.then(
                      x => resolve(x)
                      ,y => reject([y,orgIndex,index])
                    )
                )
              )
          )
        )
        .then(
          ok => 
            ok
          ,([no,orgIndex,index]) =>{
            rejected[orgIndex] = no;
            return rec(
              promises
                .filter((p,i)=>i!==index)
              ,rejected
            );
          }
        )
  ;
  if(!Array.isArray(promises)){
    return Promise.reject("The parameter passed should be an array");
  }
  if(promises.length === 0){
    return Promise.reject("Empty array passed as promises, do not know how to resolve this.");
  }
  return rec(
    promises
      .map((x,index) => [Promise.resolve(x),index])
    ,promises.map(x=>"wuh?")
  );
};

export { 
  compose
  ,throttle
  ,anyPromise
  ,queReject
  ,result
  ,liftResult
  ,timedPromise
};



/**
 * playing with service worker, maybe send more message types
 * a type to change fetch strategy (cache, whatever first, only fetch no cache, always fetch)
 * 
 */
// if('serviceWorker' in navigator){
//   // Register service worker
//   navigator.serviceWorker.register('/service-worker.js')
//   .then(
//     reg =>
//       console.log("SW registration succeeded. Scope is "+reg.scope)
//     ,err =>
//       console.error("SW registration failed with error "+err)
//   );
// }

// const send_message_to_sw = (msg) =>
//   new Promise(
//     (resolve, reject) => {
//       // Create a Message Channel
//       const msg_chan = new MessageChannel();

//       // Handler for recieving message reply from service worker
//       msg_chan.port1.onmessage = (event) => {
//           if(event.data.error){
//               reject(event.data.error);
//           }else{
//               resolve(event.data);
//           }
//       };

//       // Send message to service worker along with port for reply
//       navigator.serviceWorker.controller.postMessage(
//         msg
//         , [msg_chan.port2]
//       );
//   }
// );

// document.body.addEventListener(
//   "click"
//   ,()=>
//     send_message_to_sw(
//       {
//         action:"delete"
//         ,cache:/^v1$/
//         ,url:/.*bundle.js$/
//       }
//     )
//     .then(
//       (msg)=>
//         console.log("deleted:",msg)
//     )
// );
// window.send_message_to_sw = send_message_to_sw;