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
* turns an array of functions [fn1,fn2,fn3] into:
* fn3(fn2(fn3(x)))
* both x or any of the results of the functions can be a promise
* If it is a promse then the next function will be called with
* the resolve value of the promise.
* If the promse is rejected the next function is not called
* the handler for reject is called later down the promise chain
* for example fn2 returns a rejected promise:
* fn1(x)
* .then(x => fn2(x))
* .then(notCalled => fn3(notcalled))
* .then(undefined,called)
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
    var running = 0;
    const wait = function*(resolve,fn,arg){
      return resolve(ifPromise(fn)(arg));
    };
    const nextInQue = ()=>{
      const it = que[0];
      que=que.slice(1);
      if(it){
        it.next();
      }
      return true;
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
      ? Promise.reject(rejected)
      : Promise.race(
          promises.map(
            ([p,orgIndex],index) =>
              new Promise(
                (resolve,reject) =>
                  p.then(
                    x => resolve(x)
                    ,y => reject([y,orgIndex,index])
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