// True when this page is being shown through Google Translate's website proxy
// (https://disaster--resources-app.translate.goog/...). That copy runs on Google's host, so it has its own
// empty storage, cannot reach our account API (no CORS there, on purpose), and resolves "#route" links
// against <base href="https://disaster-resources.app/..."> which would leave the translation.
export const onTranslateProxy = () => typeof location !== 'undefined' && /\.translate\.goog$/i.test(location.hostname);
