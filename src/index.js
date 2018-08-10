//@ts-check
//not exported, checks if a value could be like promise
const promiseLike = (x) =>
  x !== undefined && typeof x.then === 'function';
//not exported, used to resolve a value later
const later = (resolveValue, time = 500) =>
  new Promise((resolve, reject) =>
    setTimeout((x) => resolve(resolveValue), time),
  );
//not exported, if x is promise then fn is called with the
//  resolve of x
const ifPromise = (fn) => (x) =>
  promiseLike(x) ? x.then(fn) : fn(x);
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
 *    //   and will return a promise (even if myFunction does not return a promise)
 *    //   if myFunction resolves within 500 milliseconds then the returned promise
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
const timedPromise = (time) => (error) => (fn) => (arg) =>
  queReject(
    Promise.race([
      queReject(Promise.resolve(arg).then(fn)),
      queReject(
        new Promise((resolve, reject) =>
          setTimeout((x) => reject(error), time),
        ),
      ),
    ]),
  );
/**
 * Do not have node crash or browser console shout at you
 *   when rejecting a promise that will not be handled
 *   by current stack but later in the message queue
 * For example:
 * const someReject = x => Promise.reject(x);
 * //this will have node crash and browser log Uncaught in Promise
 * //  the promise rejection is handled but not in the current stack
 * //  the handler is in the message queue
 * const result = someReject(x);
 * //put the reject handler in the message queue
 * setTimeout(x => result.then(undefined,x=>x),10);
 */
const queReject = (rejectValue) => {
  const r = Promise.resolve(rejectValue);
  r.then((x) => x, (x) => x);
  return r;
};
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
 *      (id === 1) //imagine this is some synchronous action looking up the user from an array
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
const result = (() => {
  const SUCCESS = {},
    FAILURE = {},
    createResult = (type) => (value) =>
      type !== SUCCESS
        ? {
            error: value,
            succeeded: false,
          }
        : {
            value: value,
            succeeded: true,
          };
  return {
    success: (val) => createResult(SUCCESS)(val),
    failure: (err) => createResult(FAILURE)(err),
  };
})();
/**
 *
 * convert a function (T->T) to (result T->result T)
 *  if a function takes a number and returns a number but could (for example)
 *  throw an exception you can lift this function to a function that takes a
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
const liftResult = (processor) => (fn) => (arg) => {
  //do not call function if argument is of type Failure
  if (arg.succeeded !== true) {
    return arg;
  }
  const initial = {};
  return processor(fn)(arg.value);
};

/**
 *
 * takes 2 functions and turns it into:
 * fn2(fn1(x)) when a value x is provided
 * if x is a promise it will turn it into:
 * x.then(x => fn2(fn1(x)))
 * if fn1(x) is a promise it will turn it into:
 * fn1(x).then(x => fn2(x))
 * if both x and fn1(x) are promises:
 * x.then(x => fn1(x)).then(x => fn2(x))
 */
const compose2 = (fn1) => (fn2) => (x) =>
  ifPromise(fn2)(ifPromise(fn1)(x));

/**
turns an array of functions [fn1,fn2,fn3] into:
fn3(fn2(fn3(x)))
both x or any of the results of the functions can be a promise
If it is a promise then the next function will be called with
the resolve value of the promise.
If the promise is rejected the next function is not called
*/
const compose = (fns) =>
  fns.reduce(
    (acc, fn) => compose2(acc)(fn),
    (x) => x, //id function
  );
/*
causes a promise returning function not to be called
until less than max are active
usage example:
max2 = throttle(2);
urls = [url1,url2,url3...url100]
Promise.all(//even though a 100 promises are created, only 2 are active
  urls.map(
    url=>
      max2(fetch)
  )
)
*/
const throttle = (max) => {
  var que = [];
  var queIndex = -1;
  var running = 0;
  const wait = (resolve, fn, arg) => () =>
    resolve(ifPromise(fn)(arg)) || true; //should always return true
  const nextInQue = () => {
    ++queIndex;
    if (typeof que[queIndex] === 'function') {
      return que[queIndex]();
    } else {
      que = [];
      queIndex = -1;
      running = 0;
      return 'Does not matter, not used';
    }
  };
  const queItem = (fn, arg) =>
    new Promise((resolve, reject) =>
      que.push(wait(resolve, fn, arg)),
    );
  return (fn) => (arg) => {
    const p = queItem(fn, arg).then(
      (x) => nextInQue() && x,
    );
    running++;
    if (running <= max) {
      nextInQue();
    }
    return p;
  };
};

/*
causes a promise returning function not to be called
if more than max within period were already called
period is time in milliseconds so 1000 is one second
when period is 1000 and max is 2 then only 2 functions will
be called every second
usage example:
twoPerSecond = throttlePeriod(2,1000);
urls = ["http://url1","http://url2",..."http://url100"];
Promise.all(//even though a 100 promises are created only 2 per second will have throttle started
  urls.map(
    (url)=>
      twoPerSecond(fetch)
  )
)
*/
const throttlePeriod = (max, period) => {
  var total = 0,
    started = undefined,
    periods = [];
  const reset = () => {
    total = 0;
    started = undefined;
    periods = [];
  };
  return (fn) => (arg) => {
    started =
      started === undefined
        ? new Date().getTime()
        : started;
    ++total;
    const now = new Date().getTime(),
      currentPeriod = Math.floor((now - started) / period);
    var next = 0;
    while ((periods[currentPeriod + next] || 0) === max) {
      ++next;
    }
    periods[currentPeriod + next] =
      periods[currentPeriod + next] === undefined
        ? 1
        : periods[currentPeriod + next] + 1;
    return later(arg, next * period + 1)
      .then(fn)
      .then(
        (x) => {
          if (--total === 0) {
            reset();
          }
          return x;
        },
        (err) => {
          if (--total === 0) {
            reset();
          }
          return Promise.reject(err);
        },
      );
  };
};

/*
causes a promise returning function not to be called
if more than max within period were already called
and there are no more than max unresolved promises
period is time in milliseconds so 1000 is one second
when period is 1000 and maxPeriod is 2 and maxActive is 2
then only maximum 2 functions will be called every second
and less if some take longer than 2 seconds to finish
usage example:
const twoPerSecondMax3Active = throttlePeriodAndActive(3,2,1000),
urls = ["http://url1","http://url2",..."http://url100"];
//even though a 100 promises are created only 2 per second will have throttle started
//  and less if request takes longer than 2 seconds
Promise.all(
  urls.map(
    (url)=>
      twoPerSecondMax3Active(fetch)
  )
)
*/
const throttlePeriodAndActive = (
  maxActive,
  maxPeriod,
  period,
) => {
  const maxA = throttle(maxActive),
    maxP = throttlePeriod(maxPeriod, period);
  return (fn) => (arg) =>
    // maxP(x=>x)(arg)
    // .then(maxA(fn))
    maxA(fn)(arg);
};
/**
 * Resolves whatever promises resolves first and rejects if all promises reject
 * with an array of rejected values in the same order as passed promises
 * or rejects when an empty array is passed
 * Not all values in the array need to be promises but anyPromise will resolve
 * with the first value that is not a promise if there are any.
 */
const anyPromise = (promises) => {
  let rec = (promises, rejected) =>
    promises.length === 0
      ? queReject(Promise.reject(rejected))
      : Promise.race(
          promises.map(([p, orgIndex], index) =>
            queReject(
              new Promise((resolve, reject) =>
                p.then(
                  (x) => resolve(x),
                  (y) => reject([y, orgIndex, index]),
                ),
              ),
            ),
          ),
        ).then(
          (ok) => ok,
          ([no, orgIndex, index]) => {
            rejected[orgIndex] = no;
            return rec(
              promises.filter((p, i) => i !== index),
              rejected,
            );
          },
        );
  if (!Array.isArray(promises)) {
    return Promise.reject(
      'The parameter passed should be an array',
    );
  }
  if (promises.length === 0) {
    return Promise.reject(
      'Empty array passed as promises, do not know how to resolve this.',
    );
  }
  return rec(
    promises.map((x, index) => [Promise.resolve(x), index]),
    promises.map((x) => 'wuh?'),
  );
};
/**
 * Creates an array from start to end where start is a number smaller than end
 * It takes an optional parameter called step that defaults to 1
 * usage example:
 * range(5,9);// [5, 6, 7, 8, 9]
 * range(5,9,1.5);// [5, 6.5, 8]
 */
const range = (start, end, step = 1) => {
  const min = start - step;
  return [...new Array(Math.floor((end - min) / step))].map(
    (val, index) => min + step * (index + 1),
  );
};
/**
 * Takes an id and a promise and resolves the promise only if it was the last one
 * This is when a user can filter a list of items but the filter is asynchronous
 * user can click on multiple UI elements causing multiple promises to be created
 * but only last requested promise needs to be resolved because older ones were replaced
 * with newer ones.
 * usage example:
 * Let's say you have a chart and user can change grouping by month or country, user can
 * click month and while request for data is resolving the user clicks on country. No
 * matter when the 2 ongoing promises resolve you only want the latest one (group by country)
 * to resolve
 * const lastChartChange = onlyLastRequestedPromise("chart");
 * Array.from(document.querySelectorAll("#chartButtons [data-group]"))
 * .map(
 *   x=>x.addEventListener(
 *     "click"
 *     ,e=>
 *       //user can click group buttons as much and as fast as they want
 *       //  only the last called changeGroup will resolve.
 *       lastChartChange(
 *         changeGroup(e.target.getAttribute("data-group"))
 *       )
 *       .then(
 *         result=>updateChart(result)
 *       )
 *   )
 * );
 */
const onlyLastRequestedPromise = ((promiseIds) => {
  const whenResolve = (
    promise,
    id,
    promiseID,
    resolveValue,
  ) => {
    if (promise !== undefined) {
      //called by user adding a promise
      promiseIds[id] = {};
    } else {
      //called because promise is resolved
      return promiseID === promiseIds[id]
        ? Promise.resolve(resolveValue)
        : Promise.reject('A newer request was made.');
    }
    return (function(currentPromiseID) {
      return promise.then(function(result) {
        return whenResolve(
          undefined,
          id,
          currentPromiseID,
          result,
        );
      });
    })(promiseIds[id]);
  };
  return (id = 'general') => (promise) =>
    whenResolve(promise, id);
})({});
/*
 * This is like d3 scale, if we have a range from 5 to 10 and the domain is 0 to 1
 * then a number of 0.2 will output 6
 * let's day I want to move from 100px to 200px in 2 seconds the time in seconds
 * is expressed in a number from 0 to 1 then I can use this the following way
 * const moveScale = scale(0)(1)(100)(200);
 * after one second (half of the period) the number representing time passed is 0.5
 * moveScale(0.5);//results in 150 (150px)
*/
const scale = (domainMin) => (domainMax) => (scaleMin) => (
  scaleMax,
) => (num) =>
  (num / (domainMax - domainMin)) * (scaleMax - scaleMin) +
  scaleMin;
const REPLACE = {};
const SAVE = {};
const createThread = (saved = []) => (fn, action) => (
  arg,
) => {
  const processResult = (result) => {
    const addAndReturn = (result) => {
      action === SAVE
        ? (saved = saved.concat([result]))
        : false;
      action === REPLACE ? (saved = [result]) : false;
      return result;
    };
    return promiseLike(result)
      ? result.then(addAndReturn)
      : addAndReturn(result);
  };
  return promiseLike(arg)
    ? arg
        .then((result) => fn(saved.concat([result])))
        .then(processResult)
    : processResult(fn(saved.concat([arg])));
};
const threadResultsOnly = (thread) => (fn, action) => (
  threadedResults,
) =>
  thread(
    //not interested in threaded values, only results of previous one
    (threadedResults) => fn(threadedResults.slice(-1)[0]),
    action,
  )(threadedResults);
const formatObject = (doForKey) => (doWithKey) => (
  object,
) => {
  const recur = (object) =>
    Object.assign(
      {},
      object,
      Object.keys(object).reduce((o, key) => {
        object[key] && typeof object[key] === 'object'
          ? (o[key] = recur(object[key]))
          : doForKey(key)
            ? (o[key] = doWithKey(object, key))
            : (o[key] = object[key]);
        return o;
      }, {}),
    );
  return recur(object);
};
//used to handle large array of data in batches, can combine with throttle
// https://stackoverflow.com/a/50650962/1641941
//@todo: test with later
const Fail = function(reason) {
  this.reason = reason;
};
const isFail = (o) => (o && o.constructor) === Fail;
const isNotFail = (o) => !isFail(o);
const batchProcess = (handleBatchResult) => (batchSize) => (
  processor,
) => (result) => (items) =>
  Promise.all(items.slice(0, batchSize).map(processor))
    .then(handleBatchResult)
    .then(
      //recursively call itself with next batch
      (batchResult) =>
        batchProcess(handleBatchResult)(batchSize)(
          processor,
        )(result.concat(batchResult))(
          items.slice(batchSize),
        ),
    );

export {
  compose,
  throttle,
  anyPromise,
  queReject,
  result,
  liftResult,
  timedPromise,
  later,
  throttlePeriod,
  range,
  onlyLastRequestedPromise,
  scale,
  createThread,
  threadResultsOnly,
  REPLACE,
  SAVE,
  formatObject,
  Fail,
  isFail,
  isNotFail,
  batchProcess,
};
