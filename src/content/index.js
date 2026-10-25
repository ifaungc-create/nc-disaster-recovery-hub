// Content in the selected language. English is the source; resources.es.js mirrors it.
import { SECTIONS as EN_S, PHONE as EN_P } from './resources.js';
import { SECTIONS as ES_S, PHONE as ES_P } from './resources.es.js';
import { isEs } from '../i18n/index.js';
export const sections = () => (isEs() ? ES_S : EN_S);
export const phoneInfo = () => (isEs() ? ES_P : EN_P);
