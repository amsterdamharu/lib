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

describe("anyPromise", function() {
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



  // it("Fail if empty array is passed", function(done) {
  //   lib.anyPromise([])
  //   .then(
  //     x => 
  //       expect("Resolve should not be called when empty array as parameter is provided").toBe(false)
  //     ,err => expect(err).not.toBeNull()
  //   )
  //   done();
  // });

});