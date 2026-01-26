(function (window) {
    function createApiClient(baseURL = '') {
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
  
      async function request(
        url,
        { method = 'POST', data = null, headers = {} } = {}
      ) {
        const res = await fetch(baseURL + url, {
          method,
          headers: {
            ...defaultHeaders,
            ...headers,
          },
          body: data ? JSON.stringify(data) : undefined,
        })
  
        let json
        try {
          json = await res.json()
        } catch {
          throw new Error('Invalid server response')
        }
  
        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || 'Request failed')
        }
  
        return json
      }
  
      return {
        get(url, options = {}) {
          return request(url, { ...options, method: 'GET' })
        },
        post(url, data, options = {}) {
          return request(url, { ...options, method: 'POST', data })
        },
        put(url, data, options = {}) {
          return request(url, { ...options, method: 'PUT', data })
        },
        delete(url, data, options = {}) {
          return request(url, { ...options, method: 'DELETE', data })
        },
      }
    }
  
    // 🌍 expose globally
    window.Api = createApiClient
    
  })(window)
  