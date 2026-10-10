import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import sv from './locales/sv.json'
import zh from './locales/zh.json'

const savedLang = localStorage.getItem('budgetos-lang') || 'pt'

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    it: { translation: it },
    pt: { translation: pt },
    ru: { translation: ru },
    sv: { translation: sv },
    zh: { translation: zh },
  },
  lng: savedLang,
  fallbackLng: 'pt',
  interpolation: { escapeValue: false },
})

export default i18n
