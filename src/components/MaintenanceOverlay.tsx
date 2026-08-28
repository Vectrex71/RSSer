import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Database, Info, MessageSquare } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const translations = {
  de: {
    flag: '🇩🇪',
    title: 'Wichtiger Hinweis: Datenbank-Umzug',
    message: 'Das Interesse an RSSer News war überwältigend und viel größer als erwartet! 🚀 Um für Tausende von Usern gleichzeitig skalieren zu können, ziehen wir gerade auf eine größere Datenbank um.',
    note: 'In der Zwischenzeit kann es zu kurzzeitigen Unterbrechungen kommen. Wir sind morgen wieder mit voller Kraft zurück!',
    apology: 'Wir bitten um Entschuldigung für die Unannehmlichkeiten.',
    close: 'Verstanden'
  },
  en: {
    flag: '🇺🇸',
    title: 'Important Note: Database Migration',
    message: 'Current interest in RSSer News has been overwhelming and much larger than expected! 🚀 To scale for thousands of users simultaneously, we are currently migrating to a larger database.',
    note: 'In the meantime, there may be temporary interruptions. We will be back tomorrow at full strength!',
    apology: 'We apologize for any inconvenience.',
    close: 'Understood'
  },
  fr: {
    flag: '🇫🇷',
    title: 'Note Importante : Migration de la Base de Données',
    message: 'L\'intérêt pour RSSer News a été accablant et bien plus important que prévu ! 🚀 Pour pouvoir évoluer pour des milliers d\'utilisateurs simultanément, nous migrons actuellement vers une base de données plus grande.',
    note: 'En attendant, il peut y avoir des interruptions temporaires. Nous serons de retour demain en force !',
    apology: 'Nous nous excusons pour tout inconvénient.',
    close: 'Compris'
  },
  it: {
    flag: '🇮🇹',
    title: 'Nota Importante: Migrazione del Database',
    message: 'L\'interesse per RSSer News è stato travolgente e molto più grande del previsto! 🚀 Per poter scalare per migliaia di utenti simultaneamente, stiamo attualmente migrando verso un database più grande.',
    note: 'Nel frattempo, potrebbero esserci interruzioni temporanee. Torneremo domani al massimo della forza!',
    apology: 'Ci scusiamo per l\'inconveniente.',
    close: 'Capito'
  },
  es: {
    flag: '🇪🇸',
    title: 'Nota Importante: Migración de Base de Datos',
    message: '¡El interés por RSSer News ha sido abrumador y mucho mayor de lo esperado! 🚀 Para poder escalar para miles de usuarios simultáneamente, estamos migrando actualmente a una base de datos más grande.',
    note: 'Mientras tanto, puede haber interrupciones temporales. ¡Estaremos de vuelta mañana con toda nuestra fuerza!',
    apology: 'Pedimos disculpas por cualquier inconveniente.',
    close: 'Entendido'
  }
};

export function MaintenanceOverlay() {
  return null;
}
