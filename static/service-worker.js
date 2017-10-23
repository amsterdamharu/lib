console.log("SW Startup!");

// Install Service Worker
self.addEventListener(
  'install'
  ,(event)=>
    console.log('installed!')
);

// Service Worker Active
self.addEventListener(
  'activate'
  ,(event)=>
  console.log('activated!')
);
self.addEventListener(
  'fetch'
  ,(event) =>
    event.respondWith(
      caches.match(event.request)
      .then((resp) =>
          resp 
          || 
          fetch(event.request)
          .then(
            (response) =>
              caches.open('v1')
              .then(
                (cache) => {
                  cache.put(event.request, response.clone());
                  return response;
                }
              )  
          )
      )
    )
);
self.addEventListener(
  'message'
  ,(event) =>{
    const data = event.data || {};
    if(data.action === "delete"){
      var p = 
        caches.keys()
        .then(
          (keyList) =>
            keyList
            .filter(
              key=>data.cache.test(key)
            )
        )
      ;
      if(data.url === undefined) {
        p = p.then(
          (keyList) =>
            Promise.all(
              keyList
              .map((key) =>{
                caches.delete(key);
                return key;
              }
            )
          )
        )
      }else {
        p = p.then(
          (keyList) =>
            Promise.all(
              keyList
              .map((key) =>
                caches.open(key)
                .then(
                  (cache)=>
                    Promise.all([
                      cache
                      ,cache.keys()
                    ])
                )
                .then(
                  ([cache,items])=>
                    Promise.all(
                      items
                      .filter(item=>data.url.test(item.url))
                      .map(
                        item=>{
                          cache.delete(item);
                          return key + ":" + item.url
                        }
                      )
                    )
                )
            )
          )
        )        
      }
      return p.then(
        (keys)=>
          event.ports[0].postMessage(
            keys
            .reduce(
              (acc,item)=>acc.concat(item)
              ,[]
            )
          )
      );
    }
  }
);
