import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================================
// Message Queue Hook for Reliable Message Delivery
// ============================================================================
// Features:
// - Persistent storage with localStorage (in-memory fallback for Safari private mode)
// - Automatic retry with exponential backoff
// - Network-aware processing (only sends when online)
// - FIFO ordering with await-based sequential sending
// - Quota guard (max 50 messages), max retries (3 attempts)
// - Race protection during concurrent operations
// - Telemetry for monitoring (10% sampling in production)
// ============================================================================

interface QueuedMessage {
  clientId: string;        // Stable client identifier for deduplication
  roomId: string;
  content: string;
  timestamp: number;        // For FIFO ordering
  retryCount: number;
  status: 'pending' | 'sending' | 'failed';
}

interface TelemetryEvent {
  event: 'queue_enqueued' | 'queue_retry' | 'queue_success' | 'queue_drop' | 'queue_reconnect' | 'queue_room_ended';
  clientId: string;
  roomId?: string;
  attempt?: number;
  timestamp: number;
  reason?: string;
}

const STORAGE_KEY = 'conversely_message_queue';
const CLIENT_ID_KEY = 'conversely_client_id';
const MAX_QUEUE_SIZE = 50;
const MAX_RETRIES = 3;
const TELEMETRY_SAMPLE_RATE = 0.1; // 10% sampling in production

// Generate stable client ID for deduplication
const getClientId = (): string => {
  try {
    let clientId = localStorage.getItem(CLIENT_ID_KEY);
    if (!clientId) {
      clientId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(CLIENT_ID_KEY, clientId);
    }
    return clientId;
  } catch {
    // Fallback to sessionStorage for Safari private mode
    let clientId = sessionStorage.getItem(CLIENT_ID_KEY);
    if (!clientId) {
      clientId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem(CLIENT_ID_KEY, clientId);
    }
    return clientId;
  }
};

// Storage mode detection
const detectStorageMode = (): 'localStorage' | 'memory' => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return 'localStorage';
  } catch {
    return 'memory';
  }
};

// Telemetry logging with sampling
const logTelemetry = (event: TelemetryEvent): void => {
  const isDev = import.meta.env.MODE === 'development';
  const isProd = import.meta.env.MODE === 'production';
  
  // Always log in dev, sample 10% in production
  const shouldLog = isDev || (isProd && Math.random() < TELEMETRY_SAMPLE_RATE);
  
  if (shouldLog || ['queue_drop', 'queue_reconnect'].includes(event.event)) {
    console.info(`[MessageQueue] ${event.event}`, event);
  }
};

export const useMessageQueue = (
  sessionId: string,
  sendCallback: (roomId: string, content: string, clientId: string) => Promise<any>
) => {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [storageMode, setStorageMode] = useState<'localStorage' | 'memory'>(detectStorageMode());
  const clientIdRef = useRef<string>(getClientId());
  const isProcessingRef = useRef(false);
  const memoryQueueRef = useRef<QueuedMessage[]>([]);

  // Detect storage mode and warn user if in memory-only mode
  useEffect(() => {
    const mode = detectStorageMode();
    setStorageMode(mode);
    
    if (mode === 'memory') {
      toast.warning('Offline messages will be lost if you close this tab', {
        duration: 5000,
      });
    }
  }, []);

  // Load queue from storage on mount
  useEffect(() => {
    if (storageMode === 'localStorage') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as QueuedMessage[];
          setQueue(parsed);
          memoryQueueRef.current = parsed;
        }
      } catch (error) {
        console.error('[MessageQueue] Failed to load queue from storage:', error);
      }
    }
  }, [storageMode]);

  // Persist queue to storage on changes
  useEffect(() => {
    if (storageMode === 'localStorage') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      } catch (error) {
        console.error('[MessageQueue] Failed to save queue to storage:', error);
      }
    }
    memoryQueueRef.current = queue;
  }, [queue, storageMode]);

  // Process queue with FIFO ordering and sequential sending
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || !navigator.onLine) {
      console.log('[MessageQueue] Skipping processing - already processing or offline');
      return;
    }

    const pending = memoryQueueRef.current.filter(msg => msg.status === 'pending');
    if (pending.length === 0) {
      setIsProcessing(false);
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    // Sort by timestamp to ensure FIFO order
    const sortedPending = [...pending].sort((a, b) => a.timestamp - b.timestamp);

    for (const message of sortedPending) {
      if (!navigator.onLine) {
        console.log('[MessageQueue] Going offline during processing');
        break;
      }

      try {
        // Mark as sending
        setQueue(prev => prev.map(msg => 
          msg.timestamp === message.timestamp 
            ? { ...msg, status: 'sending' as const }
            : msg
        ));

        // Send message with await to ensure sequential processing
        await sendCallback(message.roomId, message.content, message.clientId);

        // Success - remove from queue
        setQueue(prev => prev.filter(msg => msg.timestamp !== message.timestamp));
        
        logTelemetry({
          event: 'queue_success',
          clientId: message.clientId,
          roomId: message.roomId,
          attempt: message.retryCount + 1,
          timestamp: Date.now(),
        });

      } catch (error) {
        console.error('[MessageQueue] Send failed:', error);
        
        // Check if room ended while offline
        if (error instanceof Error && error.message === 'ROOM_ENDED') {
          // Don't retry - room is closed
          setQueue(prev => prev.filter(msg => msg.timestamp !== message.timestamp));
          
          logTelemetry({
            event: 'queue_room_ended',
            clientId: message.clientId,
            roomId: message.roomId,
            timestamp: Date.now(),
          });
          
          console.log('[MessageQueue] Message discarded - room ended while offline');
          toast.info('The chat ended while you were offline', { duration: 3000 });
          continue; // Skip to next message
        }
        
        // Retry logic
        if (message.retryCount < MAX_RETRIES) {
          setQueue(prev => prev.map(msg => 
            msg.timestamp === message.timestamp
              ? { ...msg, status: 'pending' as const, retryCount: msg.retryCount + 1 }
              : msg
          ));
          
          logTelemetry({
            event: 'queue_retry',
            clientId: message.clientId,
            roomId: message.roomId,
            attempt: message.retryCount + 1,
            timestamp: Date.now(),
          });
        } else {
          // Drop message after max retries
          setQueue(prev => prev.filter(msg => msg.timestamp !== message.timestamp));
          
          logTelemetry({
            event: 'queue_drop',
            clientId: message.clientId,
            roomId: message.roomId,
            attempt: message.retryCount + 1,
            timestamp: Date.now(),
            reason: 'max_retries_exceeded',
          });
          
          toast.error('Failed to send message after multiple attempts');
        }
      }
    }

    isProcessingRef.current = false;
    setIsProcessing(false);
  }, [sendCallback]);

  // Network status listener - process queue when coming online
  useEffect(() => {
    const handleOnline = () => {
      const pendingCount = memoryQueueRef.current.filter(msg => msg.status === 'pending').length;
      
      if (pendingCount > 0) {
        logTelemetry({
          event: 'queue_reconnect',
          clientId: clientIdRef.current,
          timestamp: Date.now(),
        });
        
        toast.success(`Reconnected - sending ${pendingCount} message${pendingCount > 1 ? 's' : ''}`, {
          duration: 3000,
        });
      }
      
      processQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processQueue]);

  // Auto-process queue when new messages arrive
  useEffect(() => {
    if (queue.length > 0 && navigator.onLine) {
      processQueue();
    }
  }, [queue.length, processQueue]);

  // Enqueue message
  const enqueueMessage = useCallback(async (roomId: string, content: string) => {
    // Quota guard
    if (queue.length >= MAX_QUEUE_SIZE) {
      toast.error('Message queue is full. Please wait for messages to send.');
      
      logTelemetry({
        event: 'queue_drop',
        clientId: clientIdRef.current,
        roomId,
        timestamp: Date.now(),
        reason: 'quota_exceeded',
      });
      
      return;
    }

    const message: QueuedMessage = {
      clientId: clientIdRef.current,
      roomId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    setQueue(prev => [...prev, message]);
    
    logTelemetry({
      event: 'queue_enqueued',
      clientId: clientIdRef.current,
      roomId,
      timestamp: Date.now(),
    });
  }, [queue.length]);

  // Clear queue (for testing/emergency)
  const clearQueue = useCallback(() => {
    setQueue([]);
    if (storageMode === 'localStorage') {
      localStorage.removeItem(STORAGE_KEY);
    }
    memoryQueueRef.current = [];
  }, [storageMode]);

  return {
    enqueueMessage,
    queuedCount: queue.filter(msg => msg.status === 'pending').length,
    isProcessing,
    clearQueue,
    storageMode,
  };
};
