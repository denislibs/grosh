import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

/**
 * Контекст приложения: { s — состояние, c — посчитанные данные, res — награды,
 * ui — действия интерфейса, session — сессия Supabase, sync — статус синхронизации }.
 */
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
