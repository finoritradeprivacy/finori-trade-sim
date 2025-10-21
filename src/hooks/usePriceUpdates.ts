import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePriceUpdates = () => {
  useEffect(() => {
    // Call the price update function every 10 seconds
    const updatePrices = async () => {
      try {
        const { error } = await supabase.functions.invoke('update-asset-prices');
        if (error) {
          console.error('Error updating prices:', error);
        }
      } catch (error) {
        console.error('Error calling price update function:', error);
      }
    };

    // Initial call
    updatePrices();

    // Set up interval for every 10 seconds
    const interval = setInterval(updatePrices, 10000);

    return () => clearInterval(interval);
  }, []);
};
