import WindowMessenger from './WindowMessenger';

const appOrigin = new URL(location.href);
appOrigin.port = self.config.appPort;
const executorUrl = new URL('/remote?bypass-sw', appOrigin);

function remoteEval(js) {
  const messenger = new WindowMessenger(executorUrl);
  let error;

  if (typeof js === 'function') {
    js = '(' + js.toString() + ')()';
  }

  return figureOutConnectionType().then(type => {
    if (type === 'offline') return ["Looks like the server is offline", 'sad.gif', false];

    return messenger.message({
      eval: js
    }).catch(err => {
      error = err;
    }).then(val => {
      messenger.destruct();
      if (error) throw error;
      return val;
    });
  });

}

function figureOutConnectionType() {
  const start = performance.now();

  return Promise.race([
    fetch(new URL('/ping', appOrigin)),
    new Promise(r => setTimeout(r, 4000))
  ]).then(_ => {
    const duration = performance.now() - start;

    if (duration < 3000) {
      return 'perfect';
    }
    if (duration < 3500) {
      return 'slow';
    }
    return 'lie-fi';
  }, _ => {
    return 'offline';
  });
}

export default {
  demo() {
    return Promise.resolve(["Yep, the demo's working!", 'demo.gif', true]);
  },
  offline() {
    return figureOutConnectionType().then(type => {
      if (type == 'offline') {
        return ["Yep! The server is totally dead!", '1.gif', true];
      }
      return ["Hmm, no, looks like the server is still up", 'nope.gif', false];
    });
  },
  ['lie-fi']() {
    return figureOutConnectionType().then(type => {
      switch(type) {
        case "lie-fi":
          return ["Yeeeep, that's lie-fi alright.", '2.gif', true];
        case "offline":
          return ["Hmm, no, looks like the server is down.", 'nope.gif', false];
        default:
          return ["The server responded way too fast for lie-fi.", 'not-quite.gif', false];
      }
    });
  },
  registered() {
    return remoteEval(function() {
      if (navigator.serviceWorker.controller) return ["Service worker successfully registered!", '3.gif', true];
      return ["Doesn't look like there's a service worker registered :(", 'nope.gif', false];
    });
  },
  ['sw-waiting']() {
    return remoteEval(function() {
      return navigator.serviceWorker.getRegistration('/').then(reg => {
        if (!reg) return ["Doesn't look like there's a service worker registered at all!", 'sad.gif', false];
        if (!reg.waiting) return ["There's no service worker waiting", 'nope.gif', false];
        return ["Yey! There's a service worker waiting!", "4.gif", true];
      });
    });
  },
  ['sw-active']() {
    return remoteEval(function() {
      return navigator.serviceWorker.getRegistration('/').then(reg => {
        if (!reg) return ["Doesn't look like there's a service worker registered at all!", 'sad.gif', false];
        if (reg.waiting) return ["There's still a service worker waiting", 'nope.gif', false];
        return ["No service worker waiting! Yay!", "5.gif", true];
      });
    });
  },
  ['html-response']() {
    return remoteEval(function() {
      return fetch('/').then(response => {
        const type = response.headers.get('content-type');

        if (!type || (type.toLowerCase() != 'text/html' && !type.toLowerCase().startsWith('text/html'))) {
          return ["The response doesn't have the 'Content-Type: text/html' header", 'nope.gif', false];
        }

        return response.text().then(text => new DOMParser().parseFromString(text, 'text/html')).then(doc => {
          if (doc.body.querySelector('.a-winner-is-me')) {
            return ["Custom HTML response found! Yay!", "6.gif", true];
          }
          return ["Can't find an element with class 'a-winner-is-me'", 'nope.gif', false];
        });
      });
    });
  },
  ['gif-response']() {
    return remoteEval(function() {
      return fetch('/').then(response => {
        const type = response.headers.get('content-type');

        if (!type || !type.toLowerCase().startsWith('text/html')) {
          return ["Looks like it isn't just URLs ending with .jpg that are being intercepted", 'not-quite.gif', false];
        }

        return fetch('/blah.jpg').then(response => {
          const type = response.headers.get('content-type');

          if (!type || !type.toLowerCase().startsWith('image/gif')) {
            return ["Doesn't look like urls ending .jpg are getting a gif in response", 'no-cry.gif', false];
          }

          return ["Images are being intercepted!", "7.gif", true];
        })
      });
    })
  },
  ['gif-404']() {
    return remoteEval(function() {
      return Promise.all([
        fetch('/'),
        fetch('/imgs/dr-evil.gif?bypass-sw'),
        fetch('/' + Math.random())
      ]).then(responses => {
        const pageType = responses[0].headers.get('content-type');

        if (!pageType || !pageType.toLowerCase().startsWith('text/html')) {
          return ["Looks like non-404 pages are getting the gif too", 'not-quite.gif', false];
        }

        const type = responses[2].headers.get('content-type');

        if (!type || !type.toLowerCase().startsWith('image/gif')) {
          return ["Doesn't look like 404 responses are getting a gif in return", 'nope.gif', false];
        }

        return Promise.all(
          responses.slice(1).map(r => r.arrayBuffer().then(b => new Uint8Array(b)))
        ).then(arrays => {
          const itemsToCheck = 2000;
          const a1 = arrays[0];
          const a2 = arrays[1];

          for (let i = 0; i < itemsToCheck; i++) {
            if (a1[i] !== a2[i]) {
              return ["Doesn't look like 404 responses are getting the dr-evil gif in return", 'not-quite.gif', false];
            }
          }
          return ["Yay! 404 pages get gifs!", "8.gif", true];
        })
      })
    });
  },
  ['install-cached']() {
    return remoteEval(function() {
      const expectedUrls = [
        '/',
        '/js/main.js',
        '/css/main.css',
        '/imgs/icon.png',
        'https://fonts.gstatic.com/s/roboto/v15/2UX7WLTfW3W8TclTUvlFyQ.woff',
        'https://fonts.gstatic.com/s/roboto/v15/d-6IYplOFocCacKzxwXSOD8E0i7KZn-EPnyo3HZu7kw.woff'
      ].map(url => new URL(url, location).href);

      return caches.has('wittr-static-v1').then(has => {
        if (!has) return ["Can't find a cache named wittr-static-v1", 'nope.gif', false];

        return caches.open('wittr-static-v1').then(c => c.keys()).then(reqs => {
          const urls = reqs.map(r => r.url);
          const allAccountedFor = expectedUrls.every(url => urls.includes(url));

          if (allAccountedFor) {
            return ["Yay! The cache is ready to go!", "9.gif", true];
          }
          return ["The cache is there, but it's missing some things", 'not-quite.gif', false];
        });
      })
    });
  },
  ['cache-served']() {
    return remoteEval(function() {
      return Promise.all([
        fetch('/'),
        fetch('/ping').then(r => r.json()).catch(e => ({ok: false}))
      ]).then(responses => {
        const cachedResponse = responses[0];
        const jsonResponse = responses[1];

        if (!jsonResponse.ok) return ["Doesn't look like non-cached requests are getting through", 'not-quite.gif', false];

        return new Promise(r => setTimeout(r, 2000)).then(_ => fetch('/')).then(response => {
          if (cachedResponse.headers.get('Date') === response.headers.get('Date')) {
            return ["Yay! Cached responses are being returned!", "10.gif", true];
          }
          return ["Doesn't look like responses are returned from the cache", 'nope.gif', false];
        })
      });
    });
  },
  ['new-cache-ready']() {
    return remoteEval(function() {
      return Promise.all([
        caches.has('wittr-static-v1'),
        caches.has('wittr-static-v2')
      ]).then(hasCaches => {
        if (!hasCaches[0]) return ["Looks like the v1 cache has already gone", 'sad.gif', false];
        if (!hasCaches[1]) return ["Can't find the wittr-static-v2 cache", 'sad.gif', false];

        return Promise.all(
          ['wittr-static-v1', 'wittr-static-v2'].map(name => {
            return caches.open(name)
              .then(c => c.match('/css/main.css'))
              .then(r => r && r.text())
          })
        ).then(cssTexts => {
          if (!cssTexts[0]) return ["Can't find CSS in the v1 cache", 'sad.gif', false];
          if (!cssTexts[1]) return ["Can't find CSS in the v2 cache", 'sad.gif', false];

          if (cssTexts[0] === cssTexts[1]) {
            return ["There's a new cache, but the CSS looks the same", 'nope.gif', false];
          }
          return ["Yay! The new cache is ready, but isn't disrupting current pages", "11.gif", true];
        });
      });
    })
  },
  ['new-cache-used']() {
    return remoteEval(function() {
      return Promise.all([
        caches.has('wittr-static-v1'),
        caches.has('wittr-static-v2')
      ]).then(hasCaches => {
        if (hasCaches[0]) return ["Looks like the v1 cache is still there", 'not-quite.gif', false];
        if (!hasCaches[1]) return ["Can't find the wittr-static-v2 cache", 'sad.gif', false];

        return Promise.all([
          fetch('/css/main.css'),
          new Promise(r => setTimeout(r, 2000)).then(_ => fetch('/css/main.css'))
        ]).then(responses => {
          if (responses[0].headers.get('Date') != responses[1].headers.get('Date')) {
            return ["Doesn't look like the CSS is being served from the cache", 'mistake.gif', false];
          }

          return getWindow('/').then(win => {
            const bg = win.getComputedStyle(win.document.querySelector('.toolbar')).backgroundColor;

            if (bg == 'rgb(63, 81, 181)') {
              return ["Doesn't look like the header color has changed", 'no-cry.gif', false]; 
            }
            return ["Yay! You safely updated the CSS!", "12.gif", true];
          });
        })
      })
    });
  }
};