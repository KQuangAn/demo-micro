'use client'

import { useEffect, useState } from 'react'
import { validateBoolean } from '../lib/utils'

export function useAuthenticated() {
   const [authenticated, setAuthenticated] = useState(null)

   useEffect(() => {
      try {
         if (typeof window !== 'undefined' && window.localStorage) {
            const cookies = document.cookie.split(';')
            const loggedInCookie =
               cookies
                  ?.find((cookie) => cookie?.startsWith('logged-in'))
                  ?.split('=')[1] === 'true'

            setAuthenticated(loggedInCookie ?? false)
         }
      } catch (error) {
         console.error({ error })
      }
   }, [])

   return { authenticated: validateBoolean(authenticated, true) }
}
