import Head from 'next/head'
import '../styles/globals.css'
import '@fortawesome/fontawesome-svg-core/styles.css'

import ZkappWorkerClient from './zkappWorkerClient';

function MyApp({ Component, pageProps }) {
  return (
  <>
  <Head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
    />
  </Head>
  <Component {...pageProps} />
  </>
  )
}

export default MyApp
