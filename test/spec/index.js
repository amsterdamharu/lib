import * as lib from '../../src/index'

const later = (resolveValue,time=500)=>
new Promise(
  (resolve,reject)=>
    setTimeout(
      x => resolve(resolveValue)
      ,time
    )
)
;
const rejectLater = (rejectValue,time=500)=>
new Promise(
(resolve,reject)=>
  setTimeout(
    x => reject(rejectValue)
    ,time
  )
)
;
const reject =
  (test)=>(done)=>(err) => {
    test(err);
    done();
  }
;
const resolve =
  (test)=>(done)=>(x) => {
    test(x)
    done();
  }
;
const shouldNotReject = 
  resolve(x=>expect("Should not reject").toBe(false))
;

describe("anyPromise", function() {
  [
    {
      param:undefined
      ,desc:"Fail if no parameter is passed"
      ,resolve:resolve(x=>expect("Resolve should not be called when no parameter is provided").toBe(false))
      ,reject:reject(x=>expect(x).not.toBeNull())
    }
    ,{
      param:[]
      ,desc:"Fail if empty array is passed"
      ,resolve:resolve(x=>expect("Resolve should not be called when empty array is passed").toBe(false))
      ,reject:reject(x=>expect(x).not.toBeNull())
      }
    ,{
      param:[later(1,10),2,3,4,5,6]
      ,desc:"Resolve to first non promise value"
      ,resolve:resolve(x=>expect(x).toBe(2))
      ,reject:shouldNotReject
    }
    ,{
      param:[rejectLater("not 1",20)]
      ,desc:`Should reject with array of ["not 1"]`
      ,resolve:resolve(x=>expect("Should not resolve").toBe(false))
      ,reject:reject(x=>expect(x.join()).toBe("not 1"))
    }
    ,{
      param:[rejectLater("not 1",60),later(2,40),rejectLater("not 3",20)]
      ,desc:"Promise that resolves should resolve"
      ,resolve:resolve(x=>expect(x).toBe(2))
      ,reject:shouldNotReject
    }
    ,{
      param:[later(1,80),later(2,20),later(3,60)]
      ,desc:"Resolve fastest promise"
      ,resolve:resolve(x=>expect(x).toBe(2))
      ,reject:shouldNotReject
    }
    ,{
      param:[rejectLater("not 1",20),later(2,40),later(3,60)]
      ,desc:"Resolve fastest resolving promise"
      ,resolve:resolve(x=>expect(x).toBe(2))
      ,reject:shouldNotReject
    }
    ,{
      param:[rejectLater("not 1",60),rejectLater("not 2",20),rejectLater("not 3",40)]
      ,desc:"Should reject with reject values in correct order if all promises reject"
      ,resolve:resolve(x=>expect("Should not resolve").toBe(false))
      ,reject:reject(x=>expect(x.join()).toBe(`not 1,not 2,not 3`))
    }
    ,{
      param:[1,2,3,4,5,6,7,8,9]
        .map(
          x => rejectLater(`not ${x}`,x*10)
        )
      ,desc:"Should reject with reject values in correct order if all promises reject"
      ,resolve:resolve(x=>expect("Should not resolve").toBe(false))
      ,reject:reject(
        x=>expect(x.join()).toBe(`not 1,not 2,not 3,not 4,not 5,not 6,not 7,not 8,not 9`)
      )
    }
    ,{
      param:[1,2,3,4,5,6,7,8,9]
        .map(
          x => rejectLater(`not ${x}`,x*10)
        )
        .concat(later(2,100))
      ,desc:"Should resolve even if only last promise resolves"
      ,resolve:resolve(x=>expect(x).toBe(2))
      ,reject:shouldNotReject
    }
  ]
  .forEach(
    config =>
      it(
        config.desc
        , done => {
          lib.anyPromise(config.param)
          .then(
            config.resolve(done)
            ,config.reject(done)
          );
        }
      )
  );
});

describe("throtle",function() {
  const doStart = (time)=>(sArr)=>(fArr)=>(x)=>{
    sArr.push(x);
    return later(x,time).then(doFinish(fArr));
  }
  ,doFinish = (fArr)=>(x)=>
    fArr.push(x)
  it(
    "resolve at the right moment"
    , done => {
      const start =[]
      ,finish =[]
      ,max2=lib.throttle(2);
      [1,2,3,4,5]
      .map(
        x=>max2(doStart(50)(start)(finish))(x)
      );
      later(false,25)
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,2")
            expect(finish.join()).toBe("")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,2,3,4")
            expect(finish.join()).toBe("1,2")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,2,3,4,5")
            expect(finish.join()).toBe("1,2,3,4")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(finish.join()).toBe("1,2,3,4,5")
          })
          (done)
      )
    }
  )
  it(
    "resolve at the right moment with rejects"
    , done => {
      const start =[]
      ,finish =[]
      ,max2=lib.throttle(2);
      [1,2,3,4,5]
      .map(
        (x,index)=>(index%2===0)?max2(doStart(50)(start)(finish))(x):x=>rejectLater(false,50)
      );
      later(false,25)
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,3")
            expect(finish.join()).toBe("")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,3,5")
            expect(finish.join()).toBe("1,3")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(finish.join()).toBe("1,3,5")
          })
          (done)
      );
    }
  )
  it(
    "resolve at the right moment earlier promises resolving later"
    , done => {
      const start =[]
      ,finish =[]
      ,max3=lib.throttle(3);
      //use the toBe values as array of array and reduce it to one promise
      // expect=x=>({toBe:x=>console.log(x)});
      [1,2,3,4,5,6,7,8,9,10]
      .map(
        x=>max3(doStart((x===1)?150:50)(start)(finish))(x)
      );
      later(false,25)
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,2,3")
            expect(finish.join()).toBe("")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,2,3,4,5")
            expect(finish.join()).toBe("2,3")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,2,3,4,5,6,7")
            expect(finish.join()).toBe("2,3,4,5")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(start.join()).toBe("1,2,3,4,5,6,7,8,9,10")
            expect(finish.join()).toBe("2,3,4,5,1,6,7")
          })
          (x=>x)
      )
      .then(x=>later(false,50))
      .then(
        resolve(
          x=>{
            expect(finish.join()).toBe("2,3,4,5,1,6,7,8,9,10")
          })
          (done)
      );
    }
  )
});

describe("compose",function() {
  it(
    "Should not resolve as promise if all functions are sync"
    , () => {
      expect(
        lib.compose([
          x=>x+1
          ,x=>x+2
          ,x=>x+3
        ])(0)
      ).toBe(6);
    }
  );
  it(
    "Should resolve as promise if some are promises"
    , done => {
      lib.compose([
        x=>later(x+1,50)
        ,x=>x+2
        ,x=>x+3
      ])(0)
      .then(
        resolve(x=>expect(x).toBe(6))(done)
        ,shouldNotReject
      )
    }
  );
  it(
    "Should skip other functions if a function returns a rejected promise"
    , done => {
      lib.compose([
        x=>x+1
        ,x=>rejectLater(x,50)
        ,x=>expect("This function should not be called").toBe(false)
      ])(0)
      .then(
        resolve(x=>expect("Should not resolve").toBe(false))(done)
        ,reject(x=>expect(x).not.toBeNull())(done)
      )
    }
  );
})