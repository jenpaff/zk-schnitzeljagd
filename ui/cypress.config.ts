import { defineConfig } from "cypress";
import { cypressBrowserPermissionsPlugin } from 'cypress-browser-permissions'

export default defineConfig({
  fixturesFolder: false,
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
      config = cypressBrowserPermissionsPlugin(on, config)
    },
    baseUrl: 'http://localhost:3000',
    /*
    config below set to avoid error: > Failed to execute 'postMessage' on 'Worker': SharedArrayBuffer transfer requires self.crossOriginIsolated.
    */ 
    chromeWebSecurity: false,
    modifyObstructiveCode: false
  },
  env: {
    browserPermissions: {
      geolocation: 'allow'
    }
  }
});
