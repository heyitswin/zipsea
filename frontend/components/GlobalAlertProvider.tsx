'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import GlobalAlert from './GlobalAlert';

interface AlertContextType {
  showAlert: (message: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

interface AlertProviderProps {
  children: ReactNode;
}

export default function GlobalAlertProvider({ children }: AlertProviderProps) {
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsVisible(true);
  };

  const handleClose = () => {
    setIsVisible(false);
    setAlertMessage('');
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <GlobalAlert
        message={alertMessage}
        isVisible={isVisible}
        onClose={handleClose}
      />
    </AlertContext.Provider>
  );
}