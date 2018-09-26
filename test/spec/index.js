//mock promise
const createPromise = () => {
  let index = 0;
  const chain = [];
  const resolveReject = (functionGetter) => (value) => {
    const fn = functionGetter(chain[index]);
    index++;
    if (typeof fn === 'function') {
      try {
        return fn(value);
      } catch (e) {
        return e;
      }
    }
    return resolveReject(functionGetter)(value);
  };
  const promise = {};
  promise.then = (resolve, reject) => {
    chain.push({ resolve, reject });
    return promise;
  };
  promise.catch = (reject) =>
    promise.then(undefined, reject);
  promise.resolve = resolveReject(({ resolve }) => resolve);
  promise.reject = resolveReject(({ reject }) => reject);
  return promise;
};
//how to use mock promise.
const promise = createPromise();
promise
  .then((x) => console.log('one:', x) || x)
  .then((x) => console.log('two:', x) || x)
  .then((x) => {
    console.log('three:', x);
    throw 'uuuhhhrrrrgggghhh';
  })
  .catch((e) => console.log('a reject', e) || e)
  .then((x) => console.log('then after reject:', x) || x)
  .then(undefined, (x) => {
    console.log('throw in a catch:', x);
    throw `throwing:${x}`;
  });

console.log(promise.resolve(1));
console.log(promise.resolve(2));
console.log(promise.resolve(3));
console.log(promise.reject(4));
// console.log(promise.resolve(5));
console.log(promise.reject(5));

//@todo: use mock promise in tests
import * as lib from '../../src/index';

const later = lib.later;
const rejectLater = (rejectValue, time = 500) =>
  lib.queReject(
    new Promise((resolve, reject) =>
      setTimeout((x) => reject(rejectValue), time),
    ),
  );
const reject = (test) => (done) => (err) => {
  test(err);
  done();
};
const resolve = (test) => (done) => (x) => {
  test(x);
  done();
};
const shouldNotReject = resolve((x) =>
  expect('Should not reject').toBe(false),
);

describe('anyPromise', function() {
  [
    {
      param: undefined,
      desc: 'Fail if no parameter is passed',
      resolve: resolve((x) =>
        expect(
          'Resolve should not be called when no parameter is provided',
        ).toBe(false),
      ),
      reject: reject((x) => expect(x).not.toBeNull()),
    },
    {
      param: [],
      desc: 'Fail if empty array is passed',
      resolve: resolve((x) =>
        expect(
          'Resolve should not be called when empty array is passed',
        ).toBe(false),
      ),
      reject: reject((x) => expect(x).not.toBeNull()),
    },
    {
      param: [(_) => later(1, 10), 2, 3, 4, 5, 6],
      desc: 'Resolve to first non promise value',
      resolve: resolve((x) => expect(x).toBe(2)),
      reject: shouldNotReject,
    },
    {
      param: [rejectLater('not 1', 20)],
      desc: `Should reject with array of ["not 1"]`,
      resolve: resolve((x) =>
        expect('Should not resolve').toBe(false),
      ),
      reject: reject((x) => expect(x.join()).toBe('not 1')),
    },
    {
      param: [
        rejectLater('not 1', 60),
        later(2, 40),
        rejectLater('not 3', 20),
      ],
      desc: 'Promise that resolves should resolve',
      resolve: resolve((x) => expect(x).toBe(2)),
      reject: shouldNotReject,
    },
    {
      param: [later(1, 9999), later(2, 20), later(3, 9999)],
      desc: 'Resolve fastest promise',
      resolve: resolve((x) => expect(x).toBe(2)),
      reject: shouldNotReject,
    },
    {
      param: [
        rejectLater('not 1', 20),
        later(2, 40),
        later(3, 60),
      ],
      desc: 'Resolve fastest resolving promise',
      resolve: resolve((x) => expect(x).toBe(2)),
      reject: shouldNotReject,
    },
    {
      param: [
        rejectLater('not 1', 60),
        rejectLater('not 2', 20),
        rejectLater('not 3', 40),
      ],
      desc:
        'Should reject with reject values in correct order if all promises reject',
      resolve: resolve((x) =>
        expect('Should not resolve').toBe(false),
      ),
      reject: reject((x) =>
        expect(x.join()).toBe(`not 1,not 2,not 3`),
      ),
    },
    {
      param: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) =>
        rejectLater(`not ${x}`, x * 10),
      ),
      desc:
        'Should reject with reject values in correct order if all promises reject',
      resolve: resolve((x) =>
        expect('Should not resolve').toBe(false),
      ),
      reject: reject((x) =>
        expect(x.join()).toBe(
          `not 1,not 2,not 3,not 4,not 5,not 6,not 7,not 8,not 9`,
        ),
      ),
    },
    {
      param: [1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((x) => rejectLater(`not ${x}`, x * 10))
        .concat(later(2, 100)),
      desc:
        'Should resolve even if only last promise resolves',
      resolve: resolve((x) => expect(x).toBe(2)),
      reject: shouldNotReject,
    },
  ].forEach((config) =>
    it(config.desc, (done) => {
      lib
        .anyPromise(
          config.param &&
            config.param.map(
              (x) => (typeof x === 'function' ? x() : x),
            ),
        )
        .then(config.resolve(done), config.reject(done));
    }),
  );
});

describe('throtle', function() {
  const doStart = (time) => (sArr) => (fArr) => (x) => {
      sArr.push(x);
      return later(x, time).then(doFinish(fArr));
    },
    doFinish = (fArr) => (x) => fArr.push(x);
  //when a throttled set completes (last promise resolves)
  //  the throttle function is reset (que=[],queIndex=-1,running=0)
  //  so it is possible to reuse a throttle function after it completes
  const max2 = lib.throttle(2);
  it('resolve at the right moment', (done) => {
    const start = [],
      finish = [];
    [1, 2, 3, 4, 5].map((x) =>
      max2(doStart(50)(start)(finish))(x),
    );
    later(false, 25)
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2');
          expect(finish.join()).toBe('');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3,4');
          expect(finish.join()).toBe('1,2');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3,4,5');
          expect(finish.join()).toBe('1,2,3,4');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(finish.join()).toBe('1,2,3,4,5');
        })(done),
      );
  });
  it('resolve at the right moment with rejects', (done) => {
    const start = [],
      finish = [];
    [1, 2, 3, 4, 5].map(
      (x, index) =>
        index % 2 === 0
          ? max2(doStart(50)(start)(finish))(x)
          : (x) => rejectLater(false, 50),
    );
    later(false, 25)
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,3');
          expect(finish.join()).toBe('');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,3,5');
          expect(finish.join()).toBe('1,3');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(finish.join()).toBe('1,3,5');
        })(done),
      );
  });
  it('resolve at the right moment earlier promises resolving later', (done) => {
    const start = [],
      finish = [],
      max3 = lib.throttle(3);
    //use the toBe values as array of array and reduce it to one promise
    // expect=x=>({toBe:x=>console.log(x)});
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) =>
      max3(doStart(x === 1 ? 150 : 50)(start)(finish))(x),
    );
    later(false, 25)
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3');
          expect(finish.join()).toBe('');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3,4,5');
          expect(finish.join()).toBe('2,3');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3,4,5,6,7');
          expect(finish.join()).toBe('2,3,4,5');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3,4,5,6,7,8,9,10');
          expect(finish.join()).toBe('2,3,4,5,1,6,7');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(finish.join()).toBe(
            '2,3,4,5,1,6,7,8,9,10',
          );
        })(done),
      );
  });
});

describe('compose', function() {
  it('Should not resolve as promise if all functions are sync', () => {
    expect(
      lib.compose([
        (x) => x + 1,
        (x) => x + 2,
        (x) => x + 3,
      ])(0),
    ).toBe(6);
  });
  it('Should resolve as promise if some are promises', (done) => {
    lib
      .compose([
        (x) => later(x + 1, 50),
        (x) => x + 2,
        (x) => x + 3,
      ])(0)
      .then(
        resolve((x) => expect(x).toBe(6))(done),
        shouldNotReject,
      );
  });
  it('Should skip other functions if a function returns a rejected promise', (done) => {
    lib
      .compose([
        (x) => x + 1,
        (x) => rejectLater(x, 50),
        (x) =>
          expect('This function should not be called').toBe(
            false,
          ),
      ])(0)
      .then(
        resolve((x) =>
          expect('Should not resolve').toBe(false),
        )(done),
        reject((x) => expect(x).not.toBeNull())(done),
      );
  });
});

describe('result', function() {
  [
    [
      'Should create a result with succeeded true',
      lib.result.success(22).succeeded,
      true,
    ],
    [
      'Should create a result with value 22',
      lib.result.success(22).value,
      22,
    ],
    [
      'Should create a result with error undefined',
      lib.result.success(22).error,
      undefined,
    ],
    [
      'Should create a result with succeeded false',
      lib.result.failure(22).succeeded,
      false,
    ],
    [
      'Should create a result with error 22',
      lib.result.failure('the error').error,
      'the error',
    ],
    [
      'Should create a result with value undefined',
      lib.result.failure('the error').value,
      undefined,
    ],
  ].map(([description, actual, expected]) =>
    it(description, () => {
      expect(actual).toBe(expected);
    }),
  );
});

describe('liftResult', function() {
  ((x) => {
    const users = [{ id: 1, name: 'Harry' }];
    const getUser = (id) =>
      users.filter((user) => user.id === id)[0];
    const getUserProcessor = (fn) => (val) => {
      const r = fn(val);
      if (r !== undefined) {
        return lib.result.success(r);
      } else {
        return lib.result.failure('User not found');
      }
    };
    const userResultById = lib.liftResult(getUserProcessor)(
      getUser,
    );
    return [
      [
        'Should return a result with value of user',
        userResultById(lib.result.success(1)).value.name,
        'Harry',
      ],
      [
        'Should return a result with succeeded true',
        userResultById(lib.result.success(1)).succeeded,
        true,
      ],
      [
        'Should return a result with error undefined',
        userResultById(lib.result.success(1)).error,
        undefined,
      ],
      [
        'Should return a result with value undefined',
        userResultById(lib.result.success(4)).value,
        undefined,
      ],
      [
        "Should return a result with error 'User not found'",
        userResultById(lib.result.success(4)).error,
        'User not found',
      ],
      [
        'Should return a result with succeeded false',
        userResultById(lib.result.success(4)).succeeded,
        false,
      ],
    ];
  })().map(([description, actual, expected]) =>
    it(description, () => {
      expect(actual).toBe(expected);
    }),
  );

  ((x) => {
    const example = (num) => {
      if (num === 1) {
        throw 'Cannot pass 1';
      } else {
        return num + 9;
      }
    };
    const tryProcessor = (fn) => (val) => {
      try {
        const res = fn(val);
        return lib.result.success(res);
      } catch (e) {
        return lib.result.failure(e);
      }
    };
    const tryResult = lib.liftResult(tryProcessor);
    return [
      [
        'Should return a result with value of 12',
        tryResult(example)(lib.result.success(11)).value,
        20,
      ],
      [
        'Should again return a result with succeeded true',
        tryResult(example)(lib.result.success(11))
          .succeeded,
        true,
      ],
      [
        'Should again return a result with error undefined',
        tryResult(example)(lib.result.success(11)).error,
        undefined,
      ],
      [
        'Should again return a result with value undefined',
        tryResult(example)(lib.result.success(1)).value,
        undefined,
      ],
      [
        "Should again return a result with error 'Cannot pass 1'",
        tryResult(example)(lib.result.success(1)).error,
        'Cannot pass 1',
      ],
      [
        'Should again return a result with succeeded false',
        tryResult(example)(lib.result.success(1)).succeeded,
        false,
      ],
    ];
  })().map(([description, actual, expected]) =>
    it(description, () => {
      expect(actual).toBe(expected);
    }),
  );
});

describe('timedPromise', function() {
  [
    {
      param: [
        25,
        'error value, timed out',
        (x) => later(x, 50),
        'resolve value',
      ],
      desc: 'Fail if timed out',
      resolve: resolve((x) =>
        expect(
          'Resolve should not be called when timed out',
        ).toBe(false),
      ),
      reject: reject((x) =>
        expect(x).toBe('error value, timed out'),
      ),
    },
    {
      param: [
        50,
        'error not used',
        (x) => rejectLater(x, 25),
        'reject with this',
      ],
      desc: 'Fail when promise function fails',
      resolve: resolve((x) =>
        expect(
          'Resolve should not be called when function rejects',
        ).toBe(false),
      ),
      reject: reject((x) =>
        expect(x).toBe('reject with this'),
      ),
    },
    {
      param: [
        50,
        'error not used',
        (x) => {
          throw "I'm throwing";
        },
        'not resolving',
      ],
      desc: 'Fail when promise function throws exception',
      resolve: resolve((x) =>
        expect(
          'Resolve should not be called when function throws',
        ).toBe(false),
      ),
      reject: reject((x) => expect(x).toBe("I'm throwing")),
    },
    {
      param: [5, 'error not used', (x) => x, 'synchronous'],
      desc:
        'Resolve synchronous promise function with value',
      resolve: resolve((x) =>
        expect(x).toBe('synchronous'),
      ),
      reject: shouldNotReject,
    },
    {
      param: [
        50,
        'error not used',
        (x) => later(x, 25),
        'resolve value',
      ],
      desc: 'Resolve promise function with value',
      resolve: resolve((x) =>
        expect(x).toBe('resolve value'),
      ),
      reject: shouldNotReject,
    },
  ].forEach((config) =>
    it(config.desc, (done) => {
      config.param
        .reduce(
          (
            acc,
            param, //lib.timedPromise(param[0])(param[1])...
          ) => acc(param),
          lib.timedPromise,
        )
        .then(config.resolve(done), config.reject(done));
    }),
  );
});

describe('throttlePeriod', function() {
  const doStart = (time) => (sArr) => (fArr) => (x) => {
      sArr.push(x);
      return later(x, time).then(doFinish(fArr));
    },
    doFinish = (fArr) => (x) => fArr.push(x);
  //when a throttled set completes (last promise resolves)
  //  the throttle function is reset
  //  so it is possible to reuse a throttle function after it completes
  const twoPer50 = lib.throttlePeriod(2, 50);
  it('resolve period throttle at the right moment', (done) => {
    const start = [],
      finish = [];
    [1, 2, 3, 4, 5].map((x) =>
      twoPer50(doStart(50)(start)(finish))(x),
    );
    later(false, 25)
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2');
          expect(finish.join()).toBe('');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3,4');
          expect(finish.join()).toBe('1,2');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3,4,5');
          expect(finish.join()).toBe('1,2,3,4');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(finish.join()).toBe('1,2,3,4,5');
        })(done),
      );
  });
  it('resolve period at the right moment with rejects', (done) => {
    const start = [],
      finish = [];
    [1, 2, 3, 4, 5].map(
      (x, index) =>
        index !== 4
          ? twoPer50(doStart(50)(start)(finish))(x)
          : (x) => rejectLater(false, 50),
    );
    later(false, 25)
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2');
          expect(finish.join()).toBe('');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(start.join()).toBe('1,2,3,4');
          expect(finish.join()).toBe('1,2');
        })((x) => x),
      )
      .then((x) => later(false, 50))
      .then(
        resolve((x) => {
          expect(finish.join()).toBe('1,2,3,4');
        })(done),
      );
  });
});

describe('onlyLastRequestedPromise', function() {
  it('Pass the last requested promise', (done) => {
    const last = lib.onlyLastRequestedPromise('fromTest');
    last(later(22, 100)).then(
      (result) => {
        expect(false).toBe('This should not resolve.');
        done();
      },
      (err) => done(),
    );
    last(later(88888888, 50)).then((result) => {
      expect(result).toBe(88888888);
    });
  });
  it('Fail promise that is older.', (done) => {
    const last = lib.onlyLastRequestedPromise('fromTest');
    last(later(22, 100)).catch((result) => {
      expect(result).toBe('A newer request was made.');
      done();
    });
    last(later(88888888, 50)).catch((result) => {
      expect(false).toBe('Should not fail.');
    });
  });
  it('Pass promise with different ids.', (done) => {
    const last = lib.onlyLastRequestedPromise('fromTest');
    const otherLast = lib.onlyLastRequestedPromise(
      'otherTest',
    );
    otherLast(later(88888888, 75)).then((result) => {
      expect(result).toBe(88888888);
      done();
    });
    last(later(88888888, 50)).then((result) => {
      expect(result).toBe(88888888);
    });
  });
});

describe('scale', function() {
  const percent = lib.scale(0)(1);
  it('Should return 150', () => {
    expect(percent(100)(200)(0.5)).toBe(150);
  });
});

//@todo: test following added functions
const testJSON = JSON.stringify({
  startDate: new Date(),
  other: 'some other value',
  range: {
    min: new Date(Date.now() - 100000),
    max: new Date(Date.now() + 100000),
    other: 22,
  },
});

//library of application specific implementation (type a to b)
const urlToResponse = (
  url, //a -> b
) =>
  Promise.resolve({
    status: 200,
    json: () => JSON.parse(testJSON),
  });
const responseToObject = (response) => response.json(); //b -> c
const objectWithDates = (
  object, //c -> d
) =>
  lib.formatObject(
    (x) =>
      x.toLowerCase().indexOf('date') !== -1 ||
      x === 'min' ||
      x === 'max',
  )((o, key) => 'Hello World')(
    //new Date(o[key]))
    object,
  );
const objectAndResponseToObjectAndStatusObject = (
  [response, object], //d -> e
) => ({
  body: object,
  status: response.status,
});

//actual work flow
const getData = (url) => {
  const thread = lib.createThread();
  return Promise.resolve(url)
    .then(thread(urlToResponse, lib.SAVE)) //save the response
    .then(responseToObject) //does not use threaded value
    .then(objectWithDates) //does no use threaded value
    .then(thread(objectAndResponseToObjectAndStatusObject)); //uses threaded value
};
getData('some url').then((results) => console.log(results));
