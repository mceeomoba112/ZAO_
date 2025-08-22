// Supabase configuration
const SUPABASE_URL = 'https://jnqnvpaglaxsxetnhzrj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpucW52cGFnbGF4c3hldG5oenJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MTQ2MjQsImV4cCI6MjA3MTM5MDYyNH0.p2LAXVWbSvGE5CuFBaaEajk1wMtsnIJaUztUPTjNoXA';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentUserProfile = null;
let messagesSubscription = null;
let friendsSubscription = null;
let notificationsSubscription = null;
let activeChat = null;
let activeChatType = 'user'; // 'user' or 'group'
let notificationPermission = 'default';
let isOnline = navigator.onLine;
let lastActivity = Date.now();

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthState();
    setupEventListeners();
    initializeMobileFeatures();
    initializeNotifications();
    setupActivityTracking();
    registerServiceWorker();
    setupNetworkStatusIndicator();
});

// Toggle password visibility
function togglePasswordVisibility(inputId, toggleButton) {
    const passwordInput = document.getElementById(inputId);
    const icon = toggleButton.querySelector('i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        toggleButton.title = 'Hide password';
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        toggleButton.title = 'Show password';
    }
}

// Register service worker for PWA
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered successfully:', registration.scope);

            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showError('App updated! Refresh to see changes.', 'success');
                    }
                });
            });
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

// Setup network status indicator
function setupNetworkStatusIndicator() {
    // Create network status element
    const networkStatus = document.createElement('div');
    networkStatus.className = 'network-status';
    networkStatus.id = 'network-status';
    document.body.prepend(networkStatus);

    function updateNetworkStatus() {
        const isOnline = navigator.onLine;
        networkStatus.textContent = isOnline ? 'Back online' : 'No internet connection';
        networkStatus.className = `network-status ${isOnline ? 'online' : ''} show`;

        // Hide online message after 3 seconds
        if (isOnline) {
            setTimeout(() => {
                networkStatus.classList.remove('show');
            }, 3000);

            // Try to reconnect to database when back online
            setTimeout(async () => {
                if (currentUser && !currentUserProfile) {
                    console.log('Attempting to reload profile after reconnection...');
                    await loadUserProfile();
                }
            }, 1000);
        }
    }

    // Update on network change
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Initial check
    if (!navigator.onLine) {
        updateNetworkStatus();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Close modals when clicking outside
    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });
    };

    // Handle online/offline status
    window.addEventListener('online', () => {
        isOnline = true;
        showError('Connection restored', 'success');
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        showError('Connection lost - you are offline', 'error');
    });

    // Handle visibility change for activity tracking
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            updateUserStatus(false);
        } else {
            updateUserStatus(true);
            lastActivity = Date.now();
        }
    });
}

// Initialize mobile features
function initializeMobileFeatures() {
    // Add viewport meta tag for mobile optimization
    if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(viewport);
    }

    // Add mobile app capabilities
    const webAppCapable = document.createElement('meta');
    webAppCapable.name = 'mobile-web-app-capable';
    webAppCapable.content = 'yes';
    document.head.appendChild(webAppCapable);

    const appleWebAppCapable = document.createElement('meta');
    appleWebAppCapable.name = 'apple-mobile-web-app-capable';
    appleWebAppCapable.content = 'yes';
    document.head.appendChild(appleWebAppCapable);

    const appleWebAppStatus = document.createElement('meta');
    appleWebAppStatus.name = 'apple-mobile-web-app-status-bar-style';
    appleWebAppStatus.content = 'black-translucent';
    document.head.appendChild(appleWebAppStatus);

    // Prevent zoom on input focus (iOS)
    document.querySelectorAll('input, select, textarea').forEach(element => {
        element.addEventListener('focus', () => {
            if (window.innerWidth < 768) {
                document.querySelector('meta[name="viewport"]').content = 
                    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            }
        });

        element.addEventListener('blur', () => {
            if (window.innerWidth < 768) {
                document.querySelector('meta[name="viewport"]').content = 
                    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            }
        });
    });

    // Handle mobile keyboard
    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', () => {
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer) {
                messagesContainer.style.height = `${window.visualViewport.height - 200}px`;
            }
        });
    }

    // Add touch gestures for mobile
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;

        // Swipe right to open sidebar (mobile)
        if (Math.abs(diffX) > Math.abs(diffY) && diffX < -100 && touchStartX < 50) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && window.innerWidth < 768) {
                sidebar.classList.add('open');
            }
        }

        // Swipe left to close sidebar (mobile)
        if (Math.abs(diffX) > Math.abs(diffY) && diffX > 100) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        }
    });
}

// Initialize push notifications
async function initializePushNotifications() {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }

    if (!('serviceWorker' in navigator)) {
        console.log('This browser does not support service workers');
        return;
    }

    try {
        // Request notification permission
        notificationPermission = await Notification.requestPermission();

        if (notificationPermission === 'granted') {
            console.log('Notification permission granted');

            // Register service worker for push notifications
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);

            // Subscribe to push notifications
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY') // You'll need to generate VAPID keys
            });

            // Save subscription to database
            await savePushSubscription(subscription);
        }
    } catch (error) {
        console.error('Error setting up push notifications:', error);
    }
}

// Initialize notifications
function initializeNotifications() {
    if ('Notification' in window) {
        notificationPermission = Notification.permission;

        if (notificationPermission === 'default') {
            // Show notification request prompt after user interaction
            setTimeout(() => {
                if (currentUser) {
                    requestNotificationPermission();
                }
            }, 5000);
        }
    }
}

// Request notification permission with device integration
async function requestNotificationPermission() {
    try {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            showError('Notifications are not supported on this device', 'error');
            return;
        }

        const permission = await Notification.requestPermission();
        notificationPermission = permission;

        if (permission === 'granted') {
            showError('🔔 Device notifications enabled!', 'success');

            // Update user settings
            await supabase
                .from('user_settings')
                .upsert({ 
                    user_id: currentUser.id,
                    notifications_enabled: true,
                    sound_enabled: true
                }, {
                    onConflict: 'user_id'
                });

            // Register for push notifications if supported
            await registerForPushNotifications();

            // Enable sound notifications on the device
            enableDeviceSounds();

        } else if (permission === 'denied') {
            showError('❌ Notifications blocked. Please enable them in your browser settings for the best experience.', 'error');

            // Update settings to reflect user choice
            await supabase
                .from('user_settings')
                .upsert({ 
                    user_id: currentUser.id,
                    notifications_enabled: false 
                }, {
                    onConflict: 'user_id'
                });
        } else {
            showError('Notification permission pending. Click the notification icon in your address bar to enable.', 'error');
        }
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        showError('Error setting up notifications: ' + error.message, 'error');
    }
}

// Register for push notifications
async function registerForPushNotifications() {
    try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.register('/sw.js');

            // Check if user is already subscribed
            const existingSubscription = await registration.pushManager.getSubscription();

            if (!existingSubscription) {
                console.log('Setting up push notifications...');
                // In a real app, you would subscribe with your VAPID keys here
                // For now, we'll just log that the setup is ready
            }
        }
    } catch (error) {
        console.error('Error setting up push notifications:', error);
    }
}

// Enable device sounds for notifications
function enableDeviceSounds() {
    try {
        // Create audio context for notification sounds (if supported)
        if ('AudioContext' in window || 'webkitAudioContext' in window) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Store the audio context for playing notification sounds
            window.notificationAudioContext = audioContext;

            console.log('Device audio for notifications enabled');
        }
    } catch (error) {
        console.error('Error enabling device sounds:', error);
    }
}

// Play notification sound
function playNotificationSound() {
    try {
        if (window.notificationAudioContext) {
            // Create a simple notification beep
            const oscillator = window.notificationAudioContext.createOscillator();
            const gainNode = window.notificationAudioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(window.notificationAudioContext.destination);

            oscillator.frequency.setValueAtTime(800, window.notificationAudioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, window.notificationAudioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.3, window.notificationAudioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, window.notificationAudioContext.currentTime + 0.2);

            oscillator.start(window.notificationAudioContext.currentTime);
            oscillator.stop(window.notificationAudioContext.currentTime + 0.2);
        }
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}

// Enhanced activity tracking with better online status management
function setupActivityTracking() {
    // Track user activity events
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    activityEvents.forEach(event => {
        document.addEventListener(event, () => {
            lastActivity = Date.now();
        }, true);
    });

    // Update activity every 15 seconds when user is active
    setInterval(async () => {
        if (currentUser && document.visibilityState === 'visible') {
            lastActivity = Date.now();
            await updateUserStatus(true);
        }
    }, 15000);

    // Check for inactive users every 30 seconds
    setInterval(async () => {
        if (currentUser) {
            const timeSinceLastActivity = Date.now() - lastActivity;
            const isInactive = timeSinceLastActivity > 180000; // 3 minutes

            if (isInactive || document.visibilityState === 'hidden') {
                await updateUserStatus(false);
            } else if (document.visibilityState === 'visible') {
                await updateUserStatus(true);
            }
        }
    }, 30000);

    // Immediate status update when page becomes visible/hidden
    document.addEventListener('visibilitychange', async () => {
        if (currentUser) {
            if (document.hidden) {
                await updateUserStatus(false);
            } else {
                lastActivity = Date.now();
                await updateUserStatus(true);
                // Trigger a full refresh when user comes back
                setTimeout(async () => {
                    await refreshOnlineStatusIndicators();
                    await updateConversationList();
                }, 1000);
            }
        }
    });

    // Update status when window gains/loses focus
    window.addEventListener('focus', async () => {
        if (currentUser) {
            lastActivity = Date.now();
            await updateUserStatus(true);
            setTimeout(async () => {
                await refreshOnlineStatusIndicators();
            }, 500);
        }
    });

    window.addEventListener('blur', async () => {
        if (currentUser) {
            await updateUserStatus(false);
        }
    });

    // Set user online when they first load the page
    if (currentUser) {
        updateUserStatus(true);
    }
}

// Update user online status with enhanced error handling
async function updateUserStatus(isOnline) {
    if (!currentUser) return;

    try {
        // Test connection before updating
        const { data, error } = await supabase
            .from('user_profiles')
            .update({
                is_online: isOnline,
                last_seen: new Date().toISOString()
            })
            .eq('user_id', currentUser.id)
            .select();

        if (error) {
            // Don't spam console with connection errors during network issues
            if (!error.message?.includes('Load failed')) {
                console.error('Error updating user status:', error);
            }
            return false;
        }

        // Update local profile
        if (currentUserProfile) {
            currentUserProfile.is_online = isOnline;
            currentUserProfile.last_seen = new Date().toISOString();
        }

        console.log(`User status updated: ${isOnline ? 'online' : 'offline'}`, data);
        return true;
    } catch (error) {
        // Don't spam console with connection errors during network issues
        if (!error.message?.includes('Load failed') && !error.message?.includes('TypeError')) {
            console.error('Error updating user status:', error);
        }
        return false;
    }
}

// Show local notification with sound
function showLocalNotification(title, body, data = {}) {
    if (notificationPermission !== 'granted') {
        return;
    }

    // Check user's sound preference
    const soundEnabled = currentUserProfile?.sound_enabled !== false;

    const notification = new Notification(title, {
        body: body,
        icon: '/icon-192.png', // You'll need to add this icon
        badge: '/badge-72.png', // You'll need to add this badge
        tag: data.type || 'message',
        data: data,
        requireInteraction: false,
        silent: !soundEnabled // Use user's sound preference
    });

    // Play custom notification sound if enabled and app is not visible
    if (soundEnabled && document.visibilityState === 'hidden') {
        playNotificationSound();
    }

    notification.onclick = function() {
        window.focus();
        notification.close();

        // Handle notification click based on type
        if (data.type === 'message' && data.sender_id) {
            // Find and open chat with sender
            const senderElement = document.querySelector(`[data-user-id="${data.sender_id}"]`);
            if (senderElement) {
                senderElement.click();
            }
        }
    };

    // Auto close notification after 6 seconds
    setTimeout(() => {
        notification.close();
    }, 6000);

    // Vibrate device if supported (for mobile)
    if ('vibrate' in navigator && soundEnabled) {
        navigator.vibrate([200, 100, 200]);
    }
}

// Helper function for VAPID key conversion
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Check if user is authenticated
async function checkAuthState() {
    try {
        console.log('Checking authentication state...');

        // First validate Supabase connection
        try {
            const { data: healthCheck } = await supabase
                .from('user_profiles')
                .select('count')
                .limit(1);

            console.log('Database connection validated');
        } catch (connectionError) {
            console.error('Database connection failed:', connectionError);
            showError('Unable to connect to database. Please check your connection and refresh the page.', 'error');
            showAuthInterface();
            return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Error getting session:', error);
            showAuthInterface();
            return;
        }

        if (session && session.user) {
            console.log('User session found:', session.user.id);
            currentUser = session.user;

            try {
                // Load user profile first
                await loadUserProfile();

                // Only show chat interface if profile loaded successfully
                if (currentUserProfile) {
                    showChatInterface();

                    // Load cached conversations first for instant access
                    loadCachedConversations();
                    
                    // Load data with error handling and sync conversations
                    await Promise.allSettled([
                        loadFriends(),
                        loadFriendRequests(),
                        syncAllConversations() // Sync all conversations on login/refresh
                    ]);

                    subscribeToMessages();
                    subscribeToFriends();

                    // Update online status
                    await updateUserStatus(true);

                    // Check if user is creator and handle auto-friendship
                    if (currentUserProfile.verification_type === 'creator') {
                        await handleCreatorAutoFriendship();
                    }

                    console.log('All conversations synced successfully');
                } else {
                    console.error('Profile could not be loaded');
                    showError('Profile loading failed. Please try logging in again.', 'error');
                    showAuthInterface();
                }
            } catch (profileError) {
                console.error('Error loading user data:', profileError);
                showError('Error loading profile data. Please try refreshing the page.', 'error');
                showAuthInterface();
            }
        } else {
            console.log('No user session found');
            showAuthInterface();
        }
    } catch (error) {
        console.error('Error in checkAuthState:', error);
        showError('Authentication error. Please refresh the page.', 'error');
        showAuthInterface();
    }
}

// Sync all conversations for persistent chat experience
async function syncAllConversations() {
    try {
        if (!currentUser) return;

        console.log('Syncing all conversations...');

        // Get all friendships
        const { data: friendships, error: friendshipError } = await supabase
            .from('friendships')
            .select('requester_id, addressee_id')
            .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
            .eq('status', 'accepted');

        if (friendshipError) {
            console.error('Error fetching friendships:', friendshipError);
            return;
        }

        if (!friendships || friendships.length === 0) {
            console.log('No friendships found to sync');
            return;
        }

        // Get all conversations
        const friendIds = friendships.map(friendship => 
            friendship.requester_id === currentUser.id 
                ? friendship.addressee_id 
                : friendship.requester_id
        );

        console.log(`Found ${friendIds.length} friends to sync conversations with`);

        // Pre-load conversation data for all friends
        const conversationPromises = friendIds.map(async (friendId) => {
            try {
                const { data: messages, error: messageError } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`and(user_id.eq.${currentUser.id},recipient_id.eq.${friendId}),and(user_id.eq.${friendId},recipient_id.eq.${currentUser.id})`)
                    .order('created_at', { ascending: true });

                if (messageError) {
                    console.error(`Error fetching messages for friend ${friendId}:`, messageError);
                    return {
                        friendId,
                        messageCount: 0,
                        latestMessage: null,
                        unreadCount: 0,
                        messages: []
                    };
                }

                const unreadCount = messages ? messages.filter(msg => 
                    msg.user_id === friendId && 
                    msg.recipient_id === currentUser.id && 
                    !msg.is_read
                ).length : 0;

                // Add profile info to messages
                const messagesWithProfiles = messages ? messages.map(message => ({
                    ...message,
                    user_profiles: message.user_id === currentUser.id ? currentUserProfile : null
                })) : [];

                return {
                    friendId,
                    messageCount: messagesWithProfiles.length,
                    latestMessage: messagesWithProfiles.length > 0 ? messagesWithProfiles[messagesWithProfiles.length - 1] : null,
                    unreadCount: unreadCount,
                    messages: messagesWithProfiles,
                    lastUpdated: new Date().toISOString()
                };
            } catch (error) {
                console.error(`Error syncing conversation with ${friendId}:`, error);
                return {
                    friendId,
                    messageCount: 0,
                    latestMessage: null,
                    unreadCount: 0,
                    messages: [],
                    lastUpdated: new Date().toISOString()
                };
            }
        });

        const conversationData = await Promise.allSettled(conversationPromises);
        const successfulSyncs = conversationData
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value);

        console.log(`Synced ${successfulSyncs.length} conversations successfully`);
        
        // Store conversation data locally for quick access and persistence
        if (!window.conversationCache) {
            window.conversationCache = {};
        }
        
        successfulSyncs.forEach(conv => {
            if (conv && conv.friendId) {
                window.conversationCache[conv.friendId] = conv;
            }
        });

        // Save to localStorage for persistence across sessions
        try {
            localStorage.setItem(`conversations_${currentUser.id}`, JSON.stringify(window.conversationCache));
            console.log('All conversations saved to localStorage successfully');
        } catch (storageError) {
            console.warn('Could not save conversations to localStorage:', storageError);
            // Try to save individual conversations if bulk save fails
            for (const conv of successfulSyncs) {
                try {
                    const individualKey = `conversation_${currentUser.id}_${conv.friendId}`;
                    localStorage.setItem(individualKey, JSON.stringify(conv));
                } catch (individualError) {
                    console.warn(`Could not save individual conversation ${conv.friendId}:`, individualError);
                }
            }
        }

        console.log('All conversations synced and cached successfully');

    } catch (error) {
        console.error('Error syncing conversations:', error);
    }
}

// Load user profile with verification status
async function loadUserProfile() {
    try {
        if (!currentUser || !currentUser.id) {
            console.error('No current user found');
            showError('Please log in again', 'error');
            return;
        }

        console.log('Loading profile for user:', currentUser.id);

        // Test Supabase connection first
        try {
            const { data: testData, error: testError } = await supabase
                .from('user_profiles')
                .select('count')
                .limit(1);

            if (testError) {
                console.error('Supabase connection test failed:', testError);
                throw new Error('Database connection failed');
            }
        } catch (connectionError) {
            console.error('Database connection error:', connectionError);
            showError('Unable to connect to database. Please check your internet connection and try again.', 'error');
            return;
        }

        // First get the basic user profile with retry logic
        let profileData = null;
        let profileError = null;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                const result = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .single();

                profileData = result.data;
                profileError = result.error;
                break;
            } catch (err) {
                retryCount++;
                console.error(`Profile load attempt ${retryCount} failed:`, err);

                if (retryCount >= maxRetries) {
                    profileError = err;
                    break;
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }

        if (profileError) {
            console.error('Profile query error after retries:', profileError);

            // Try to create profile if it doesn't exist
            if (profileError.code === 'PGRST116' || profileError.message?.includes('No rows found')) {
                console.log('Profile not found, creating new profile...');
                await createUserProfile();
                return;
            }

            // Handle other specific errors
            if (profileError.message?.includes('Load failed') || profileError.message?.includes('TypeError')) {
                showError('Database connection unstable. Please refresh the page.', 'error');
                return;
            }

            throw profileError;
        }

        if (!profileData) {
            console.log('No profile data returned, creating new profile...');
            await createUserProfile();
            return;
        }

        // Set basic profile data first
        currentUserProfile = { ...profileData };

        // Try to get verification status data (optional - don't fail if missing)
        try {
            const { data: adminData } = await supabase
                .from('admin_users')
                .select('admin_level, permissions')
                .eq('user_id', currentUser.id)
                .single();

            const { data: creatorData } = await supabase
                .from('creators')
                .select('creator_type, special_permissions')
                .eq('user_id', currentUser.id)
                .single();

            const { data: premiumData } = await supabase
                .from('premium_users')
                .select('premium_type, expires_at, features')
                .eq('user_id', currentUser.id)
                .single();

            // Add verification data if available
            currentUserProfile.admin_users = adminData || null;
            currentUserProfile.creators = creatorData || null;
            currentUserProfile.premium_users = premiumData || null;
        } catch (verificationError) {
            console.log('Verification tables not accessible, skipping verification status');
            // Don't fail - just continue without verification badges
        }

        // Update profile display elements
        updateProfileDisplay();

        // Update user info in header
        const userNameElement = document.getElementById('user-name');
        const userUsernameElement = document.getElementById('user-username');

        if (userNameElement) {
            userNameElement.textContent = currentUserProfile.full_name || 'User';
        }

        if (userUsernameElement) {
            userUsernameElement.textContent = `@${currentUserProfile.username || 'loading...'}`;
        }

        // Update the settings form with current profile data
        updateSettingsForm();

        // Ensure user has username
        if (!currentUserProfile.username || currentUserProfile.username === '') {
            console.log('Username missing, generating...');
            await ensureUserHasUsername();
        }

        console.log('User profile loaded successfully:', currentUserProfile);

        // Initialize early access features for the user
        setTimeout(async () => {
            await showEarlyAccessFeatures();
        }, 1000);
    } catch (error) {
        console.error('Error loading user profile:', error);
        showError('Failed to load user profile. Retrying...', 'error');

        // Try to create profile as fallback
        setTimeout(async () => {
            try {
                await createUserProfile();
            } catch (createError) {
                console.error('Error creating profile:', createError);
                showError('Unable to create user profile. Please contact support.', 'error');
            }
        }, 2000);
    }
}

// Update profile display with verification badges
function updateProfileDisplay() {
    if (!currentUserProfile) return;

    const profileElements = document.querySelectorAll('.profile-name, .current-user-name');
    const verificationBadge = getVerificationBadge(currentUserProfile);

    profileElements.forEach(element => {
        if (element) {
            element.innerHTML = `${currentUserProfile.full_name} ${verificationBadge}`;
        }
    });

    // Update profile settings display
    const profileFullName = document.getElementById('profile-fullname');
    const profileUsername = document.getElementById('profile-username');

    if (profileFullName) {
        profileFullName.value = currentUserProfile.full_name;
    }

    if (profileUsername) {
        profileUsername.innerHTML = `@${currentUserProfile.username} ${verificationBadge}`;
    }

    // Update header user info with verification
    const userNameElement = document.getElementById('user-name');
    const userUsernameElement = document.getElementById('user-username');

    if (userNameElement) {
        userNameElement.innerHTML = `${currentUserProfile.full_name} ${verificationBadge}`;
    }

    if (userUsernameElement) {
        userUsernameElement.innerHTML = `@${currentUserProfile.username}`;
    }

    // Add verification details to settings modal
    updateVerificationSection();
}

// Function to update verification section in settings
function updateVerificationSection() {
    if (!currentUserProfile) return;

    const verificationInfo = getDetailedVerificationInfo(currentUserProfile);

    // Only show verification details if the user has an admin-approved verification type
    if (currentUserProfile.is_verified && currentUserProfile.verification_type && currentUserProfile.verification_type !== 'email' && verificationInfo.badge) {
        let verificationSection = document.getElementById('verification-section');
        if (!verificationSection) {
            // Find the placeholder in the settings modal HTML
            const settingsModalBody = document.querySelector('#settings-modal .modal-body');
            if (settingsModalBody) {
                verificationSection = document.createElement('div');
                verificationSection.id = 'verification-section';
                verificationSection.className = 'settings-section';
                settingsModalBody.insertBefore(verificationSection, settingsModalBody.lastElementChild);
            } else {
                return; // Modal body not found
            }
        }

        verificationSection.innerHTML = `
            <div class="verification-details">
                <div class="verification-header">
                    <h3>Verification Status ${verificationInfo.badge}</h3>
                    <p class="verification-description">${verificationInfo.description}</p>
                </div>
                <div class="verification-benefits">
                    <h4>Your Benefits:</h4>
                    <ul>
                        ${verificationInfo.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    } else {
        // Show the verification request button if not verified by admin
        let verificationSection = document.getElementById('verification-section');
        if (!verificationSection) {
            const settingsModalBody = document.querySelector('#settings-modal .modal-body');
            if (settingsModalBody) {
                verificationSection = document.createElement('div');
                verificationSection.id = 'verification-section';
                verificationSection.className = 'settings-section';
                settingsModalBody.insertBefore(verificationSection, settingsModalBody.lastElementChild);
            } else {
                return; // Modal body not found
            }
        }

        verificationSection.innerHTML = `
            <div class="verification-request">
                <h3>Get Verified</h3>
                <p>Verification badges are granted by administrators only. Submit a request for review.</p>
                <button onclick="requestVerification()" class="request-verification-btn">
                    Request Admin Review
                </button>
                <div style="margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.6);">
                    <i class="fas fa-info-circle"></i> Note: Not all users will be approved for verification. Administrators review each request individually.
                </div>
            </div>
        `;
    }
}

// Update settings form with current profile data
function updateSettingsForm() {
    if (!currentUserProfile) return;

    try {
        const settingsFullName = document.getElementById('settings-fullname');
        const settingsBio = document.getElementById('settings-bio');
        const settingsUsername = document.getElementById('settings-username');

        if (settingsFullName) {
            settingsFullName.value = currentUserProfile.full_name || '';
        }

        if (settingsBio) {
            settingsBio.value = currentUserProfile.bio || '';
        }

        if (settingsUsername) {
            if (currentUserProfile.username && currentUserProfile.username !== '') {
                settingsUsername.value = currentUserProfile.username;
                settingsUsername.style.color = '#667eea';
                settingsUsername.style.fontWeight = '600';
            } else {
                settingsUsername.value = 'Generating username...';
                settingsUsername.style.color = '#fbbf24';
                settingsUsername.style.fontWeight = '400';
            }
        }
    } catch (error) {
        console.error('Error updating settings form:', error);
    }
}

// Ensure user has a username (for existing users)
async function ensureUserHasUsername() {
    try {
        // Use the database function to ensure username
        const { data, error } = await supabase.rpc('ensure_user_has_username', {
            user_uuid: currentUser.id
        });

        if (error) {
            console.error('Error calling ensure_user_has_username:', error);
            // Fallback: try to generate username directly
            await generateUsernameDirectly();
            return;
        }

        if (data) {
            // Update current profile with new username
            if (currentUserProfile) {
                currentUserProfile.username = data;
            }

            // Update UI elements
            const usernameElement = document.getElementById('user-username');
            if (usernameElement) {
                usernameElement.textContent = `@${data}`;
            }

            const settingsUsernameElement = document.getElementById('settings-username');
            if (settingsUsernameElement) {
                settingsUsernameElement.value = data;
                settingsUsernameElement.style.color = '#667eea';
                settingsUsernameElement.style.fontWeight = '600';
            }

            console.log('Username assigned successfully:', data);
        }
    } catch (error) {
        console.error('Error ensuring username:', error);
        await generateUsernameDirectly();
    }
}

// Fallback function to generate username directly
async function generateUsernameDirectly() {
    try {
        // Generate a simple unique username
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 1000);
        const username = `ZAO_${timestamp.toString().slice(-6)}${randomNum.toString().padStart(3, '0')}`;

        const { error } = await supabase
            .from('user_profiles')
            .update({ username: username })
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Update current profile and UI
        if (currentUserProfile) {
            currentUserProfile.username = username;
        }

        const usernameElement = document.getElementById('user-username');
        if (usernameElement) {
            usernameElement.textContent = `@${username}`;
        }

        const settingsUsernameElement = document.getElementById('settings-username');
        if (settingsUsernameElement) {
            settingsUsernameElement.value = username;
            settingsUsernameElement.style.color = '#667eea';
            settingsUsernameElement.style.fontWeight = '600';
        }

        console.log('Username generated directly:', username);
    } catch (error) {
        console.error('Error generating username directly:', error);
    }
}

// Create user profile if it doesn't exist
async function createUserProfile() {
    try {
        const { error } = await supabase
            .from('user_profiles')
            .insert([
                {
                    user_id: currentUser.id,
                    full_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    phone_number: currentUser.phone || '',
                    username: '' // Will be auto-generated by trigger
                }
            ]);

        if (error) throw error;

        // Create default settings
        await supabase
            .from('user_settings')
            .insert([
                {
                    user_id: currentUser.id,
                    theme: 'dark',
                    notifications_enabled: true,
                    sound_enabled: true
                }
            ]);

        // Reload profile
        await loadUserProfile();
    } catch (error) {
        console.error('Error creating profile:', error);
    }
}

// Ensure notifications are enabled and request permission
async function ensureNotificationsEnabled() {
    try {
        // Load user settings
        const { data: settings, error: settingsError } = await supabase
            .from('user_settings')
            .select('notifications_enabled, sound_enabled')
            .eq('user_id', currentUser.id)
            .single();

        if (settings && settings.notifications_enabled && notificationPermission !== 'granted') {
            // Auto-request notification permission if user has it enabled in settings
            setTimeout(() => {
                requestNotificationPermission();
            }, 1000);
        }
    } catch (error) {
        console.error('Error checking notification settings:', error);
    }
}

// Show/Hide interfaces
function showAuthInterface() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('chat-container').classList.add('hidden');
}

function showChatInterface() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');

    // Ensure cancel button is hidden when chat interface loads
    const cancelButton = document.querySelector('.cancel-chat-button');
    if (cancelButton) {
        cancelButton.classList.add('hidden');
    }
}

// Tab switching
function showLogin() {
    document.getElementById('login-tab').classList.add('active');
    document.getElementById('register-tab').classList.remove('active');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
}

function showRegister() {
    document.getElementById('register-tab').classList.add('active');
    document.getElementById('login-tab').classList.remove('active');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
}

// Navigation tabs
function showChats() {
    setActiveNavTab(0);
    document.getElementById('chats-content').classList.remove('hidden');
    document.getElementById('friends-content').classList.add('hidden');
    document.getElementById('friend-requests-content').classList.add('hidden');
}

function showFriends() {
    setActiveNavTab(1);
    document.getElementById('chats-content').classList.add('hidden');
    document.getElementById('friends-content').classList.remove('hidden');
    document.getElementById('friend-requests-content').classList.add('hidden');
}

function showFriendRequests() {
    setActiveNavTab(2);
    document.getElementById('chats-content').classList.add('hidden');
    document.getElementById('friends-content').classList.add('hidden');
    document.getElementById('friend-requests-content').classList.remove('hidden');
}

function setActiveNavTab(index) {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });
}

// Handle registration
async function handleRegister(event) {
    event.preventDefault();

    const fullName = document.getElementById('register-fullname').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }

    try {
        // Sign up with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) throw error;

        if (data.user) {
            // Wait a moment for auth to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Create user profile with auto-generated username
            const { error: profileError } = await supabase
                .from('user_profiles')
                .insert([
                    {
                        user_id: data.user.id,
                        full_name: fullName,
                        email: email,
                        phone_number: phone,
                        username: '' // Will be auto-generated by trigger
                    }
                ]);

            if (profileError) throw profileError;

            // Create default user settings with notifications enabled
            const { error: settingsError } = await supabase
                .from('user_settings')
                .insert([
                    {
                        user_id: data.user.id,
                        theme: 'dark',
                        notifications_enabled: true,
                        sound_enabled: true
                    }
                ]);

            if (settingsError) throw settingsError;

            // Ensure username is assigned immediately for new accounts
            await ensureUserHasUsername();

            // Automatically request notification permissions for new users
            setTimeout(() => {
                requestNotificationPermission();
            }, 2000);

            showError('Registration successful! Please check your email to verify your account. Note: Verification badges are only granted by administrators.', 'success');
        }
    } catch (error) {
        showError(error.message);
    }
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                showError('Invalid email or password. Please check your credentials and try again.');
            } else if (error.message.includes('Email not confirmed')) {
                showError('Please check your email and click the confirmation link before logging in.');
            } else {
                showError('Login failed: ' + error.message);
            }
            return;
        }

        if (!data.user) {
            showError('Login failed: No user data received');
            return;
        }

        currentUser = data.user;

        // Try to load user profile with retry for existing users
        try {
            await loadUserProfile();

            if (!currentUserProfile) {
                showError('Profile loading failed. Trying to create missing profile...');
                await createUserProfile();
            }

            showChatInterface();
            await Promise.allSettled([
                loadFriends(),
                loadFriendRequests()
            ]);

            subscribeToMessages();
            subscribeToFriends();

            showError('Welcome back!', 'success');
        } catch (profileError) {
            console.error('Profile loading error:', profileError);
            showError('Error loading your profile. Please contact support if this persists.');
        }
    } catch (error) {
        showError(error.message);
    }
}

// Handle logout
async function handleLogout() {
    try {
        if (messagesSubscription) {
            messagesSubscription.unsubscribe();
        }
        if (friendsSubscription) {
            friendsSubscription.unsubscribe();
        }
        if (notificationsSubscription) {
            notificationsSubscription.unsubscribe();
        }

        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        currentUser = null;
        currentUserProfile = null;
        activeChat = null;
        showAuthInterface();
        document.getElementById('chat-messages').innerHTML = '';
    } catch (error) {
        showError(error.message);
    }
}

// Load friends list with enhanced online status tracking, conversation capabilities, and creator prioritization
async function loadFriends() {
    try {
        // Get friendships first
        const { data: friendships, error: friendshipsError } = await supabase
            .from('friendships')
            .select('*')
            .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
            .eq('status', 'accepted');

        if (friendshipsError) throw friendshipsError;

        // Update both friends list and user list (chats)
        const friendsList = document.getElementById('friends-list');
        const userList = document.getElementById('user-list');
        
        friendsList.innerHTML = '';
        userList.innerHTML = '';

        if (!friendships || friendships.length === 0) {
            const noFriendsMessage = '<div class="no-friends" style="padding: 20px; text-align: center; color: rgba(255,255,255,0.6);"><p>No friends yet. Start by sending friend requests!</p></div>';
            friendsList.innerHTML = noFriendsMessage;
            userList.innerHTML = noFriendsMessage;
            return;
        }

        // Get friend user IDs
        const friendUserIds = friendships.map(friendship => 
            friendship.requester_id === currentUser.id 
                ? friendship.addressee_id 
                : friendship.requester_id
        );

        // Get friend profiles with enhanced data
        const { data: friendProfiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('user_id, full_name, username, is_online, is_verified, verification_type, avatar_url, last_seen')
            .in('user_id', friendUserIds);

        if (profilesError) throw profilesError;

        // Enhanced sorting: Creator/Founder first, then online users, then offline users
        const sortedFriends = friendProfiles.sort((a, b) => {
            // Priority 1: Creator/Founder first
            const aIsCreator = a.verification_type === 'creator' || a.verification_type === 'founder';
            const bIsCreator = b.verification_type === 'creator' || b.verification_type === 'founder';
            
            if (aIsCreator && !bIsCreator) return -1;
            if (!aIsCreator && bIsCreator) return 1;
            
            // Priority 2: Online status
            if (a.is_online && !b.is_online) return -1;
            if (!a.is_online && b.is_online) return 1;
            
            // Priority 3: Alphabetical by name
            return a.full_name.localeCompare(b.full_name);
        });

        // Load conversation data for persistent sync
        await loadConversationData(sortedFriends);

        sortedFriends.forEach(friend => {
            if (friend) {
                // Create elements for both lists
                const friendElement = createUserElement(friend, 'friend');
                const chatElement = createUserElement(friend, 'chat');
                
                friendsList.appendChild(friendElement);
                userList.appendChild(chatElement);
            }
        });

        console.log('Friends loaded:', sortedFriends.length, 'friends');
        console.log('Creator/Founder users pinned to top');
    } catch (error) {
        console.error('Error loading friends:', error);
        showError('Failed to load friends', 'error');
    }
}

// Load cached conversations for instant access
function loadCachedConversations() {
    try {
        if (!currentUser) return;

        const cachedData = localStorage.getItem(`conversations_${currentUser.id}`);
        if (cachedData) {
            window.conversationCache = JSON.parse(cachedData);
            console.log('Loaded conversations from cache:', Object.keys(window.conversationCache).length, 'conversations');
        } else {
            window.conversationCache = {};
        }
    } catch (error) {
        console.error('Error loading cached conversations:', error);
        window.conversationCache = {};
    }
}

// Save conversation to cache and localStorage
async function saveConversationToCache(friendId, messages) {
    try {
        if (!currentUser || !friendId) return;

        // Initialize cache if not exists
        if (!window.conversationCache) {
            window.conversationCache = {};
        }

        const unreadCount = messages ? messages.filter(msg => 
            msg.user_id === friendId && 
            msg.recipient_id === currentUser.id && 
            !msg.is_read
        ).length : 0;

        // Update conversation cache
        window.conversationCache[friendId] = {
            friendId: friendId,
            messageCount: messages ? messages.length : 0,
            latestMessage: messages && messages.length > 0 ? messages[messages.length - 1] : null,
            unreadCount: unreadCount,
            messages: messages || [],
            lastUpdated: new Date().toISOString()
        };

        // Save to localStorage for persistence
        try {
            localStorage.setItem(`conversations_${currentUser.id}`, JSON.stringify(window.conversationCache));
            console.log(`Conversation with ${friendId} saved to cache and localStorage`);
        } catch (storageError) {
            console.warn('Could not save to localStorage:', storageError);
            // Try to clean up old data
            try {
                localStorage.removeItem(`conversations_${currentUser.id}`);
                localStorage.setItem(`conversations_${currentUser.id}`, JSON.stringify(window.conversationCache));
            } catch (cleanupError) {
                console.warn('Could not save conversation to localStorage even after cleanup');
            }
        }
    } catch (error) {
        console.error('Error saving conversation to cache:', error);
    }
}

// Load conversation data for persistent syncing
async function loadConversationData(friends) {
    try {
        // Get latest message for each conversation to show message previews
        for (const friend of friends) {
            // Check cache first
            const cachedConv = window.conversationCache && window.conversationCache[friend.user_id];
            if (cachedConv) {
                friend.latestMessage = cachedConv.latestMessage;
                friend.unreadCount = cachedConv.unreadCount;
                continue;
            }

            // Fetch from database if not in cache
            const { data: latestMessage } = await supabase
                .from('messages')
                .select('content, created_at, user_id')
                .or(`and(user_id.eq.${currentUser.id},recipient_id.eq.${friend.user_id}),and(user_id.eq.${friend.user_id},recipient_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (latestMessage) {
                friend.latestMessage = latestMessage;
            }

            // Get unread message count
            const { count: unreadCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', friend.user_id)
                .eq('recipient_id', currentUser.id)
                .eq('is_read', false);

            friend.unreadCount = unreadCount || 0;
        }
    } catch (error) {
        console.error('Error loading conversation data:', error);
    }
}

// Update conversation list
async function updateConversationList() {
    // This function is now integrated into loadFriends
    await loadFriends();
}

// Groups functionality removed
async function loadGroups() {
    // Groups functionality has been removed
    const groupsList = document.getElementById('group-list');
    if (groupsList) {
        groupsList.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.6); padding: 20px;">Groups have been disabled</p>';
    }
}

// Load friend requests
async function loadFriendRequests() {
    try {
        // Ensure user is logged in
        if (!currentUser || !currentUser.id) {
            console.log('User not logged in, skipping friend requests load');
            return;
        }

        // Get pending requests with better error handling
        const { data: requests, error: requestError } = await supabase
            .from('friendships')
            .select('*')
            .eq('addressee_id', currentUser.id)
            .eq('status', 'pending');

        if (requestError) {
            console.error('Error loading friend requests:', requestError);

            // Handle specific error types
            if (requestError.code === '42501' || requestError.message.includes('permission denied')) {
                console.log('Permission denied for friendships table - user may need to re-authenticate');
                // Don't show error to user, just log and continue
                const friendRequestsList = document.getElementById('friend-requests-list');
                if (friendRequestsList) {
                    friendRequestsList.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center; padding: 20px;">Unable to load friend requests. Please try refreshing the page.</p>';
                }
                return;
            }
            throw requestError;
        }

        const friendRequestsList = document.getElementById('friend-requests-list');
        friendRequestsList.innerHTML = '';

        // Update request count badge
        const requestCountBadge = document.getElementById('request-count');
        if (requestCountBadge) {
            if (!requests || requests.length === 0) {
                requestCountBadge.classList.add('hidden');
                requestCountBadge.textContent = '0';
            } else {
                requestCountBadge.classList.remove('hidden');
                requestCountBadge.textContent = requests.length.toString();
            }
        }

        if (!requests || requests.length === 0) {
            friendRequestsList.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center; padding: 20px;">No pending friend requests.</p>';
            return;
        }

        // Get requester profiles
        const requesterIds = requests.map(request => request.requester_id);
        const { data: requesterProfiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('full_name, username, avatar_url, user_id')
            .in('user_id', requesterIds);

        if (profileError) throw profileError;

        requests.forEach(request => {
            const requester = requesterProfiles.find(profile => profile.user_id === request.requester_id);
            if (requester) {
                const requestWithProfile = {
                    ...request,
                    requester: requester
                };
                const friendRequestElement = createFriendRequestElement(requestWithProfile);
                friendRequestsList.appendChild(friendRequestElement);
            }
        });
    } catch (error) {
        console.error('Error loading friend requests:', error);
        showError('Error loading friend requests: ' + error.message, 'error');
    }
}

// Create user element with enhanced online status indicators
function createUserElementWithStatus(user, type) {
    const element = document.createElement('div');
    element.className = 'user-item';
    element.setAttribute('data-user-id', user.user_id);
    element.onclick = () => {
        if (type === 'friend') {
            openChat(user);
        }
    };

    const avatarContent = user.avatar_url 
        ? `<img src="${user.avatar_url}" alt="${user.full_name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` 
        : user.full_name.charAt(0).toUpperCase();

    const isOnline = user.is_online === true;
    const onlineStatus = isOnline ? 'online' : 'offline';
    const statusIndicator = `<div class="status-indicator ${onlineStatus}"></div>`;

    // Format last seen time
    let statusText = '';
    if (isOnline) {
        statusText = '<div class="online-text">Online</div>';
    } else {
        const lastSeen = user.last_seen ? new Date(user.last_seen) : new Date();
        const timeDiff = Date.now() - lastSeen.getTime();
        const minutesAgo = Math.floor(timeDiff / 60000);

        if (minutesAgo < 1) {
            statusText = '<div class="offline-text">Just now</div>';
        } else if (minutesAgo < 60) {
            statusText = `<div class="offline-text">${minutesAgo}m ago</div>`;
        } else {
            const hoursAgo = Math.floor(minutesAgo / 60);
            if (hoursAgo < 24) {
                statusText = `<div class="offline-text">${hoursAgo}h ago</div>`;
            } else {
                statusText = '<div class="offline-text">Offline</div>';
            }
        }
    }

    // Create verification badge if user is verified
    const verificationBadge = getVerificationBadge(user);

    element.innerHTML = `
        <div class="user-avatar" style="position: relative;">
            ${avatarContent}
            ${statusIndicator}
        </div>
        <div class="user-details">
            <div class="user-name">${user.full_name} ${verificationBadge}</div>
            <div class="user-username">@${user.username}</div>
            ${statusText}
        </div>
    `;

    return element;
}

// Helper function to get verification badge HTML with emoji system
function getVerificationBadge(user) {
    // Only show badges for admin-approved verification types
    if (!user || !user.is_verified || !user.verification_type) {
        return '';
    }

    // Show email verification badge for now (since that's what the user has)
    let badgeClass = 'verification-badge';
    let badgeIcon = '✅';
    let badgeTitle = 'Verified';

    switch (user.verification_type) {
        case 'creator':
            badgeClass += ' creator';
            badgeIcon = '👑';
            badgeTitle = 'App Creator & Founder';
            break;
        case 'admin':
            badgeClass += ' admin';
            badgeIcon = '🔰';
            badgeTitle = 'Administrator';
            break;
        case 'premium':
            badgeClass += ' premium';
            badgeIcon = '💎';
            badgeTitle = 'Premium User';
            break;
        case 'email':
            badgeClass += ' verified';
            badgeIcon = '✅';
            badgeTitle = 'Email Verified';
            break;
        case 'verified':
            badgeClass += ' verified';
            badgeIcon = '✅';
            badgeTitle = 'Verified User';
            break;
        default:
            // Show basic verification for unknown types
            badgeClass += ' verified';
            badgeIcon = '✅';
            badgeTitle = 'Verified';
            break;
    }

    return `<span class="${badgeClass}" title="${badgeTitle}">${badgeIcon}</span>`;
}

// Function to get detailed verification info for profiles
function getDetailedVerificationInfo(user) {
    // Only show verification info for admin-approved verification types
    if (!user || !user.is_verified || !user.verification_type || user.verification_type === 'email') {
        return {
            badge: '',
            description: '',
            benefits: []
        };
    }

    const badge = getVerificationBadge(user);
    let description = '';
    let benefits = [];

    switch (user.verification_type) {
        case 'creator':
            description = '👑 App Creator & Founder';
            benefits = [
                '🚀 Created ZAO Chat application',
                '🔑 Full system access and privileges', 
                '⭐ Priority support and development input',
                '🎯 Special creator-only features',
                '🔨 User moderation and banning capabilities',
                '🤝 Auto-friendship with all users',
                '🎁 Early access to all new features'
            ];
            break;
        case 'admin':
            description = '🔰 Platform Administrator';
            benefits = [
                '👨‍💼 User moderation capabilities',
                '📋 Content management access',
                '🔧 Platform maintenance privileges',
                '🛡️ Enhanced security features',
                '✅ Can assign verification badges',
                '🚫 Can ban/restrict users'
            ];
            break;
        case 'premium':
            description = '💎 Premium Member';
            benefits = [
                '☁️ Unlimited media storage',
                '🎧 Priority customer support',
                '🎨 Custom themes and personalization',
                '✨ Advanced messaging features',
                '🎁 Early access to beta features',
                '🔍 Advanced search capabilities'
            ];
            break;
        default:
            description = '✅ Verified User';
            benefits = [
                '🆔 Verified identity and authenticity',
                '🤝 Trusted community member',
                '📈 Enhanced profile visibility',
                '🔍 Priority in search results'
            ];
    }

    return { badge, description, benefits };
}

// Check if user has early access to features
async function hasEarlyAccess(featureName) {
    if (!currentUser || !currentUserProfile) return false;

    try {
        // Simple check based on user verification type (exclude email verification)
        if (!currentUserProfile.verification_type || currentUserProfile.verification_type === 'email') return false;

        const allowedTypes = ['premium', 'creator', 'admin', 'verified'];
        return allowedTypes.includes(currentUserProfile.verification_type);
    } catch (error) {
        console.error('Error checking early access:', error);
        return false;
    }
}

// Show early access features based on user status
async function showEarlyAccessFeatures() {
    if (!currentUserProfile) return;

    // Check for beta messaging features
    if (await hasEarlyAccess('beta_messaging')) {
        // Show advanced messaging options
        addAdvancedMessageFeatures();
    }

    // Check for custom themes
    if (await hasEarlyAccess('custom_themes')) {
        // Show theme customization
        addCustomThemeOptions();
    }

    // Check for admin panel access
    if (await hasEarlyAccess('admin_panel')) {
        // Show admin controls
        addAdminPanelButton();
    }
}

// Add advanced message features for premium users
function addAdvancedMessageFeatures() {
    const messageInputContainer = document.querySelector('.message-input-container');
    if (messageInputContainer && !document.getElementById('advanced-features')) {
        const advancedFeatures = document.createElement('div');
        advancedFeatures.id = 'advanced-features';
        advancedFeatures.style.cssText = 'display: flex; gap: 8px; margin-bottom: 10px; opacity: 0.8;';
        advancedFeatures.innerHTML = `
            <button class="media-button premium-feature" title="Voice Message (Premium)" onclick="showPremiumFeature('Voice Messages')">
                <i class="fas fa-microphone"></i>
            </button>
            <button class="media-button premium-feature" title="Schedule Message (Premium)" onclick="showPremiumFeature('Message Scheduling')">
                <i class="fas fa-clock"></i>
            </button>
            <button class="media-button premium-feature" title="Message Reactions (Premium)" onclick="showPremiumFeature('Message Reactions')">
                <i class="fas fa-heart"></i>
            </button>
        `;
        messageInputContainer.insertBefore(advancedFeatures, messageInputContainer.firstChild);
    }
}

// Add custom theme options for premium users
function addCustomThemeOptions() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal && !document.getElementById('theme-section')) {
        const themeSection = document.createElement('div');
        themeSection.id = 'theme-section';
        themeSection.className = 'settings-section';
        themeSection.innerHTML = `
            <h4>🎨 Premium Themes</h4>
            <div class="theme-options" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px;">
                <div class="theme-option" onclick="applyTheme('dark')" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center; cursor: pointer;">
                    <div style="color: white; font-weight: bold;">Dark</div>
                </div>
                <div class="theme-option" onclick="applyTheme('midnight')" style="background: linear-gradient(135deg, #2c3e50 0%, #000000 100%); padding: 20px; border-radius: 8px; text-align: center; cursor: pointer;">
                    <div style="color: white; font-weight: bold;">Midnight</div>
                </div>
                <div class="theme-option" onclick="applyTheme('galaxy')" style="background: linear-gradient(135deg, #8360c3 0%, #2ebf91 100%); padding: 20px; border-radius: 8px; text-align: center; cursor: pointer;">
                    <div style="color: white; font-weight: bold;">Galaxy</div>
                </div>
            </div>
        `;

        const modalBody = settingsModal.querySelector('.modal-body');
        modalBody.insertBefore(themeSection, modalBody.lastElementChild);
    }
}

// Add admin panel button for creators/admins
function addAdminPanelButton() {
    const headerButtons = document.querySelector('.header-buttons');
    if (headerButtons && !document.getElementById('admin-panel-btn')) {
        const adminButton = document.createElement('button');
        adminButton.id = 'admin-panel-btn';
        adminButton.className = 'icon-button admin-button';
        adminButton.title = 'Admin Panel';
        adminButton.onclick = showAdminPanel;
        adminButton.innerHTML = '<i class="fas fa-shield-alt"></i>';
        headerButtons.insertBefore(adminButton, headerButtons.lastElementChild);
    }
}

// Show premium feature placeholder
function showPremiumFeature(featureName) {
    showError(`🎁 ${featureName} - Premium Feature Coming Soon!`, 'info');
}

// Apply custom theme
function applyTheme(themeName) {
    showError(`🎨 Applied ${themeName} theme!`, 'success');
    // Theme application logic would go here
}

// Show admin panel
function showAdminPanel() {
    if (!currentUserProfile || (!currentUserProfile.verification_type === 'creator' && !currentUserProfile.verification_type === 'admin')) {
        showError('Access denied. Admin privileges required.', 'error');
        return;
    }

    // Create admin panel modal
    const adminModal = document.createElement('div');
    adminModal.className = 'modal';
    adminModal.id = 'admin-panel-modal';
    adminModal.innerHTML = `
        <div class="modal-content glass-card">
            <div class="modal-header">
                <h3><i class="fas fa-shield-alt"></i> Admin Panel</h3>
                <button class="close-button" onclick="closeModal('admin-panel-modal'); this.parentElement.parentElement.parentElement.remove();">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="admin-section">
                    <h4>User Management</h4>
                    <div class="admin-actions">
                        <button class="auth-button" onclick="showUserManagement()">
                            <i class="fas fa-users"></i> Manage Users
                        </button>
                        <button class="auth-button" onclick="showVerificationManagement()">
                            <i class="fas fa-check-circle"></i> Assign Verification
                        </button>
                        <button class="auth-button" onclick="showBanManagement()">
                            <i class="fas fa-ban"></i> Ban/Restrict Users
                        </button>
                    </div>
                </div>
                <div class="admin-section">
                    <h4>Feature Management</h4>
                    <div class="admin-actions">
                        <button class="auth-button" onclick="showFeatureManagement()">
                            <i class="fas fa-cog"></i> Early Access Features
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(adminModal);
}

// Placeholder admin functions
function showUserManagement() {
    showError('👥 User Management panel coming soon!', 'info');
}

function showVerificationManagement() {
    showError('✅ Verification Management panel coming soon!', 'info');
}

function showBanManagement() {
    showError('🚫 Ban Management panel coming soon!', 'info');
}

function showFeatureManagement() {
    showError('🎛️ Feature Management panel coming soon!', 'info');
}

// Create user element with proper click handling for conversations
function createUserElement(user, type) {
    const element = document.createElement('div');
    element.className = 'user-item';
    element.setAttribute('data-user-id', user.user_id);
    
    // Make all user items clickable to start conversations
    element.onclick = () => {
        console.log('User clicked:', user.full_name, 'Type:', type);
        openChat(user);
    };

    element.style.cursor = 'pointer';

    const avatarContent = user.avatar_url 
        ? `<img src="${user.avatar_url}" alt="${user.full_name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` 
        : user.full_name.charAt(0).toUpperCase();

    const isOnline = user.is_online === true;
    const onlineStatus = isOnline ? 'online' : 'offline';
    const statusIndicator = `<div class="status-indicator ${onlineStatus}"></div>`;

    // Format last seen time
    let statusText = '';
    if (isOnline) {
        statusText = '<div class="online-text" style="color: #10b981; font-size: 12px; font-weight: 500;">Online</div>';
    } else {
        const lastSeen = user.last_seen ? new Date(user.last_seen) : new Date();
        const timeDiff = Date.now() - lastSeen.getTime();
        const minutesAgo = Math.floor(timeDiff / 60000);

        if (minutesAgo < 1) {
            statusText = '<div class="offline-text" style="color: #6b7280; font-size: 12px; font-weight: 500;">Just now</div>';
        } else if (minutesAgo < 60) {
            statusText = `<div class="offline-text" style="color: #6b7280; font-size: 12px; font-weight: 500;">${minutesAgo}m ago</div>`;
        } else {
            const hoursAgo = Math.floor(minutesAgo / 60);
            if (hoursAgo < 24) {
                statusText = `<div class="offline-text" style="color: #6b7280; font-size: 12px; font-weight: 500;">${hoursAgo}h ago</div>`;
            } else {
                statusText = '<div class="offline-text" style="color: #6b7280; font-size: 12px; font-weight: 500;">Offline</div>';
            }
        }
    }

    // Create verification badge if user is verified
    const verificationBadge = getVerificationBadge(user);

    element.innerHTML = `
        <div class="user-avatar" style="position: relative;">
            ${avatarContent}
            ${statusIndicator}
        </div>
        <div class="user-details">
            <div class="user-name">${user.full_name} ${verificationBadge}</div>
            <div class="user-username">@${user.username}</div>
            ${statusText}
        </div>
    `;

    return element;
}

// Maintain backward compatibility
function createUserElementWithStatus(user, type) {
    return createUserElement(user, type);
}

// Create friend request element
function createFriendRequestElement(request) {
    const element = document.createElement('div');
    element.className = 'friend-request-item';

    const requester = request.requester;
    const avatar = requester.avatar_url 
        ? `<img src="${requester.avatar_url}" class="user-avatar" alt="${requester.full_name}">` 
        : `<div class="user-avatar">${requester.full_name.charAt(0).toUpperCase()}</div>`;

    element.innerHTML = `
        ${avatar}
        <div class="user-details">
            <div class="user-name">${requester.full_name}</div>
            <div class="user-username">@${requester.username}</div>
            <div class="request-actions">
                <button class="accept-request-button" data-request-id="${request.id}" data-requester-id="${requester.user_id}">Accept</button>
                <button class="reject-request-button" data-request-id="${request.id}">Reject</button>
            </div>
        </div>
    `;

    // Add event listeners for accept/reject buttons
    element.querySelector('.accept-request-button').addEventListener('click', () => acceptFriendRequest(request.id, requester.user_id));
    element.querySelector('.reject-request-button').addEventListener('click', () => rejectFriendRequest(request.id));

    return element;
}

// Accept friend request
async function acceptFriendRequest(requestId, requesterId) {
    try {
        // Update friendship status to 'accepted'
        const { error } = await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (error) throw error;

        showError('Friend request accepted!', 'success');

        // Reload friends and requests
        await loadFriends();
        await loadFriendRequests();
    } catch (error) {
        showError('Error accepting request: ' + error.message);
    }
}

// Reject friend request
async function rejectFriendRequest(requestId) {
    try {
        // Delete the friendship request
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', requestId);

        if (error) throw error;

        showError('Friend request rejected.', 'success');

        // Reload requests
        await loadFriendRequests();
    } catch (error) {
        showError('Error rejecting request: ' + error.message);
    }
}

// Creator Auto-Friendship Logic
async function handleCreatorAutoFriendship() {
    if (!currentUser || !currentUserProfile || currentUserProfile.verification_type !== 'creator') {
        return;
    }

    console.log('Creator detected. Initiating auto-friendship check...');

    try {
        // Fetch all active users (excluding the creator themselves)
        const { data: allUsers, error: usersError } = await supabase
            .from('user_profiles')
            .select('user_id, username')
            .neq('user_id', currentUser.id);

        if (usersError) throw usersError;

        if (!allUsers || allUsers.length === 0) {
            console.log('No other users found to auto-friend.');
            return;
        }

        let friendshipsCreated = 0;
        for (const user of allUsers) {
            // Check if a friendship already exists between creator and this user
            const { data: existingFriendship, error: friendshipError } = await supabase
                .from('friendships')
                .select('*')
                .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${user.user_id}),and(requester_id.eq.${user.user_id},addressee_id.eq.${currentUser.id})`);

            if (friendshipError) {
                console.error(`Error checking friendship with ${user.username}:`, friendshipError);
                continue; // Skip to next user
            }

            // If no friendship exists, create one
            if (!existingFriendship || existingFriendship.length === 0) {
                const { error: createError } = await supabase
                    .from('friendships')
                    .insert([
                        {
                            requester_id: currentUser.id,
                            addressee_id: user.user_id,
                            status: 'accepted' // Auto-accepted friendship
                        }
                    ]);

                if (createError) {
                    console.error(`Error creating friendship with ${user.username}:`, createError);
                } else {
                    friendshipsCreated++;
                    console.log(`Auto-friended ${user.username}`);
                }
            }
        }

        if (friendshipsCreated > 0) {
            showError(`Automatically friended ${friendshipsCreated} new user(s).`, 'success');
            // Reload friends list to reflect the changes
            await loadFriends();
        } else {
            console.log('No new friendships to create.');
        }

    } catch (error) {
        console.error('Error during creator auto-friendship:', error);
        showError('Failed to complete auto-friendship process.', 'error');
    }
}

// Select user for chat
function openChat(user) {
    activeChat = user;
    activeChatType = 'user';

    console.log('Opening chat with user:', user);

    // Clear any existing messages first
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    chatMessages.style.display = 'flex';
    chatMessages.style.flexDirection = 'column';

    // Update chat header with verification badge and title
    const chatTitleText = document.getElementById('chat-title-text');
    const verificationBadge = getVerificationBadge(user);
    if (chatTitleText) {
        chatTitleText.innerHTML = `${user.full_name} ${verificationBadge}`;
    }

    // Enable message input and send button
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    if (messageInput) {
        messageInput.disabled = false;
        messageInput.placeholder = 'Type your message...';
    }
    if (sendButton) {
        sendButton.disabled = false;
    }

    // Update active state in all user lists (friends and chats)
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });

    const userElements = document.querySelectorAll(`[data-user-id="${user.user_id}"]`);
    userElements.forEach(element => {
        element.classList.add('active');
    });

    // Load messages for this chat
    loadMessages();

    // Mark messages as read
    markMessagesAsRead(user.user_id);

    // Show cancel chat button
    const cancelButton = document.querySelector('.cancel-chat-button');
    if (cancelButton) {
        cancelButton.classList.remove('hidden');
    }

    // Close sidebar on mobile after selecting chat
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth < 768) {
        sidebar.classList.remove('open');
    }

    console.log('Chat opened successfully with:', user.full_name);
}

// Load messages for active chat with enhanced error handling and persistent syncing
async function loadMessages() {
    if (!activeChat || activeChatType !== 'user') {
        console.log('No active chat or wrong chat type');
        return;
    }

    try {
        console.log('Loading messages for chat with user:', activeChat.user_id);

        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';

        // First try to load from cache for instant display
        const cachedConversation = window.conversationCache && window.conversationCache[activeChat.user_id];
        if (cachedConversation && cachedConversation.messages && cachedConversation.messages.length > 0) {
            console.log('Loading cached messages first:', cachedConversation.messages.length);
            
            // Display cached messages immediately
            cachedConversation.messages.forEach(message => {
                const messageWithProfile = {
                    ...message,
                    user_profiles: message.user_id === currentUser.id ? currentUserProfile : activeChat
                };
                displayMessage(messageWithProfile);
            });

            // Scroll to bottom
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 50);
        }

        // Query messages between current user and active chat user with simplified query
        const { data: messagesData, error } = await supabase
            .from('messages')
            .select('id, user_id, recipient_id, content, message_type, media_url, media_type, media_size, media_name, is_read, created_at')
            .or(`and(user_id.eq.${currentUser.id},recipient_id.eq.${activeChat.user_id}),and(user_id.eq.${activeChat.user_id},recipient_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error loading messages:', error);
            // Don't fail completely - show conversation UI and allow new messages
            if (!cachedConversation || !cachedConversation.messages || cachedConversation.messages.length === 0) {
                showStartConversationUI();
            }
            return;
        }

        // Clear container and reload with fresh data
        messagesContainer.innerHTML = '';

        if (!messagesData || messagesData.length === 0) {
            console.log('No messages found - showing start conversation message');
            showStartConversationUI();
        } else {
            console.log(`Loading ${messagesData.length} messages in conversation`);
            
            // Process messages and add profile info
            const messagesWithProfiles = messagesData.map(message => {
                const userProfile = message.user_id === currentUser.id ? currentUserProfile : activeChat;
                return {
                    ...message,
                    user_profiles: userProfile
                };
            });
            
            // Display all messages in chronological order
            messagesWithProfiles.forEach(message => {
                displayMessage(message);
            });

            // Save to cache for persistence
            await saveConversationToCache(activeChat.user_id, messagesWithProfiles);

            // Scroll to bottom to show latest messages
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);

            console.log('Messages displayed and cached successfully');
        }

        // Mark messages as read
        await markMessagesAsRead(activeChat.user_id);

        console.log('Messages loaded successfully for conversation with:', activeChat.full_name);
    } catch (error) {
        console.error('Error loading messages:', error);
        // Show conversation UI anyway to allow new messages
        if (!messagesContainer.innerHTML || messagesContainer.innerHTML.trim() === '') {
            showStartConversationUI();
        }
    }
}

// Helper function to show start conversation UI
function showStartConversationUI() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem;">
            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 20px; padding: 40px; max-width: 400px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">💬</div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px;">Start your conversation</h3>
                <p style="color: var(--text-secondary); font-size: 16px;">Send the first message to ${activeChat.full_name}</p>
            </div>
        </div>
    `;
}

// Subscribe to real-time messages with enhanced features and conversation saving
function subscribeToMessages() {
    if (messagesSubscription) {
        messagesSubscription.unsubscribe();
    }

    messagesSubscription = supabase
        .channel('messages')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages'
            }, 
            async (payload) => {
                console.log('New message received:', payload);

                const message = payload.new;

                // Only process if the message involves current user
                if (message.user_id === currentUser.id || message.recipient_id === currentUser.id) {

                    // Determine which friend this message is with
                    const friendId = message.user_id === currentUser.id ? message.recipient_id : message.user_id;

                    // If it's for the current active chat, display immediately
                    if (activeChat && activeChat.user_id === friendId) {
                        const messageWithProfile = {
                            ...message,
                            user_profiles: message.user_id === currentUser.id ? currentUserProfile : activeChat
                        };

                        displayMessage(messageWithProfile);

                        // Auto-scroll to bottom
                        const chatContainer = document.getElementById('chat-messages');
                        chatContainer.scrollTop = chatContainer.scrollHeight;

                        // Mark as read if it's received message
                        if (message.recipient_id === currentUser.id) {
                            markMessagesAsRead(message.user_id);
                        }

                        // Reload and save current conversation
                        setTimeout(() => {
                            reloadAndSaveCurrentConversation();
                        }, 1000);
                    } else {
                        // Save message to cache for non-active conversations
                        await saveMessageToConversationCache(message, friendId);
                    }

                    // Update friends list to show new message indicator
                    loadFriends();

                    // Show browser notification for received messages
                    if (message.recipient_id === currentUser.id && Notification.permission === 'granted') {
                        const { data: senderProfile } = await supabase
                            .from('user_profiles')
                            .select('full_name')
                            .eq('user_id', message.user_id)
                            .single();

                        showLocalNotification(
                            `New message from ${senderProfile?.full_name || 'Someone'}`,
                            message.content,
                            { type: 'message', sender_id: message.user_id }
                        );
                    }
                }
            }
        )
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages'
            },
            (payload) => {
                // Handle message updates (like read status)
                const messageElement = document.querySelector(`[data-message-id="${payload.new.id}"]`);
                if (messageElement && payload.new.is_read) {
                    const readStatus = messageElement.querySelector('.read-status');
                    if (readStatus) {
                        readStatus.textContent = '✓✓';
                    }
                }
            }
        )
        .subscribe();
}

// Save individual message to conversation cache
async function saveMessageToConversationCache(message, friendId) {
    try {
        if (!currentUser || !friendId) return;

        // Initialize cache if not exists
        if (!window.conversationCache) {
            window.conversationCache = {};
        }

        // Get existing conversation or create new one
        if (!window.conversationCache[friendId]) {
            window.conversationCache[friendId] = {
                friendId: friendId,
                messageCount: 0,
                latestMessage: null,
                unreadCount: 0,
                messages: [],
                lastUpdated: new Date().toISOString()
            };
        }

        // Add message to cached messages
        const messageWithProfile = {
            ...message,
            user_profiles: message.user_id === currentUser.id ? currentUserProfile : null
        };

        window.conversationCache[friendId].messages.push(messageWithProfile);
        window.conversationCache[friendId].latestMessage = messageWithProfile;
        window.conversationCache[friendId].messageCount += 1;
        window.conversationCache[friendId].lastUpdated = new Date().toISOString();

        // Update unread count if it's a received message
        if (message.recipient_id === currentUser.id && !message.is_read) {
            window.conversationCache[friendId].unreadCount += 1;
        }

        // Save to localStorage
        try {
            localStorage.setItem(`conversations_${currentUser.id}`, JSON.stringify(window.conversationCache));
            console.log(`Message added to conversation cache for ${friendId}`);
        } catch (storageError) {
            console.warn('Could not save message to localStorage:', storageError);
        }
    } catch (error) {
        console.error('Error saving message to conversation cache:', error);
    }
}

// Subscribe to friends list updates
function subscribeToFriends() {
    if (friendsSubscription) {
        friendsSubscription.unsubscribe();
    }

    friendsSubscription = supabase
        .channel('friendships')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'friendships'
            },
            () => {
                loadFriends();
                loadFriendRequests();
            }
        )
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'user_profiles'
            },
            () => {
                loadFriends(); // Refresh friends list to update online status
                // Also update active chat header if the active chat user's status changes
                if (activeChat) {
                    const updatedProfile = currentUserProfile; // This should ideally fetch the latest data
                    if (updatedProfile && updatedProfile.user_id === activeChat.user_id) {
                        const chatHeader = document.querySelector('.chat-header h2');
                        const verificationBadge = getVerificationBadge(updatedProfile);
                        chatHeader.innerHTML = `${updatedProfile.full_name} ${verificationBadge}`;
                    }
                }
            }
        )
        .subscribe();
}

// Subscribe to notifications
function subscribeToNotifications() {
    if (notificationsSubscription) {
        notificationsSubscription.unsubscribe();
    }

    notificationsSubscription = supabase
        .channel('notifications')
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUser.id}`
            },
            (payload) => {
                loadNotifications();
                showInAppNotification(payload.new);
            }
        )
        .subscribe();
}

// Mark messages as read
async function markMessagesAsRead(senderId) {
    try {
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('user_id', senderId)
            .eq('recipient_id', currentUser.id)
            .eq('is_read', false);

        if (error) throw error;
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// Enhanced send message with real-time sync and conversation saving
async function sendMessage() {
    if (!activeChat || activeChatType !== 'user') return;

    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();

    if (!content) return;

    try {
        // Optimistically display the message immediately
        const tempMessage = {
            id: 'temp-' + Date.now(),
            user_id: currentUser.id,
            recipient_id: activeChat.user_id,
            content: content,
            message_type: 'text',
            created_at: new Date().toISOString(),
            is_read: false,
            user_profiles: currentUserProfile // Use current user's profile for sender info
        };

        displayMessage(tempMessage);
        messageInput.value = '';

        // Send to database
        const { data: insertedData, error } = await supabase
            .from('messages')
            .insert([{
                user_id: currentUser.id,
                recipient_id: activeChat.user_id,
                content: content,
                message_type: 'text'
            }])
            .select('*');

        if (error) throw error;

        // Get the inserted message with profile data
        const messagesWithProfiles = insertedData.map(message => ({
            ...message,
            user_profiles: currentUserProfile
        }));

        // Replace temp message with real message from database
        if (messagesWithProfiles && messagesWithProfiles[0]) {
            const tempElement = document.querySelector(`[data-message-id="temp-${tempMessage.id.split('-')[1]}"]`);
            if (tempElement) {
                tempElement.remove();
            }
            displayMessage(messagesWithProfiles[0]);

            // Load all messages for this conversation and update cache
            await reloadAndSaveCurrentConversation();
        }

        // Auto-scroll to bottom
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Create notification for recipient
        await createNotification(activeChat.user_id, 'message', 
            `New message from ${currentUserProfile.full_name}`, content);

        console.log('Message sent and conversation saved successfully');

    } catch (error) {
        console.error('Error sending message:', error);
        showError('Failed to send message');

        // Remove temp message on error
        const tempElement = document.querySelector(`[data-message-id="temp-${tempMessage.id.split('-')[1]}"]`);
        if (tempElement) {
            tempElement.remove();
        }
    }
}

// Reload and save current conversation
async function reloadAndSaveCurrentConversation() {
    if (!activeChat || !currentUser) return;

    try {
        // Fetch all messages for current conversation
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(user_id.eq.${currentUser.id},recipient_id.eq.${activeChat.user_id}),and(user_id.eq.${activeChat.user_id},recipient_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error reloading conversation:', error);
            return;
        }

        // Add profile info to messages
        const messagesWithProfiles = messages.map(message => ({
            ...message,
            user_profiles: message.user_id === currentUser.id ? currentUserProfile : activeChat
        }));

        // Save to cache
        await saveConversationToCache(activeChat.user_id, messagesWithProfiles);

        console.log('Current conversation reloaded and saved to cache');
    } catch (error) {
        console.error('Error reloading and saving conversation:', error);
    }
}

// Media functions
function selectImage() {
    const input = document.getElementById('media-input');
    input.accept = 'image/*';
    input.click();
}

function selectVideo() {
    const input = document.getElementById('media-input');
    input.accept = 'video/*';
    input.click();
}

async function handleMediaUpload(event) {
    if (!activeChat) return;

    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        showError('File size must be less than 50MB');
        return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
        showError('Unsupported file type. Please upload images (JPEG, PNG, GIF, WebP) or videos (MP4, WebM, MOV)');
        return;
    }

    try {
        showError('Uploading media...', 'success');

        // Create unique filename with user folder structure
        const fileExtension = file.name.split('.').pop();
        const fileName = `${currentUser.id}/media/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;

        // Upload file to Supabase Storage
        const { data, error } = await supabase.storage
            .from('media')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(fileName);

        // Send message with media
        const messageData = {
            content: '', // Content can be empty for media-only messages
            user_id: currentUser.id,
            message_type: file.type.startsWith('image/') ? 'image' : 'video',
            media_url: publicUrl,
            media_type: file.type,
            media_size: file.size,
            media_name: file.name,
            recipient_id: activeChat.user_id,
            created_at: new Date().toISOString(), // Set created_at for real-time ordering
            is_read: false // New messages are unread
        };

        // Insert into the database
        const { data: insertedMessage, error: messageError } = await supabase
            .from('messages')
            .insert([messageData])
            .select('*');

        if (messageError) throw messageError;

        // Add profile data to the message
        const messageWithProfile = insertedMessage.map(message => ({
            ...message,
            user_profiles: currentUserProfile
        }));

        if (messageError) throw messageError;

        // Display the message immediately (real-time updates handled by subscription)
        if (messageWithProfile && messageWithProfile[0]) {
            displayMessage(messageWithProfile[0]);
        }

        // Auto-scroll to bottom
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Create notification for recipient
        await createNotification(activeChat.user_id, messageData.message_type, 
            `New ${messageData.message_type} from ${currentUserProfile.full_name}`, messageData.content || `Sent a ${messageData.message_type}`);

        showError('Media sent successfully!', 'success');
    } catch (error) {
        console.error('Error uploading media:', error);
        showError('Error uploading media: ' + error.message);
    } finally {
        // Clear the file input
        event.target.value = '';
    }
}

// Friend request functions
function showAddFriend() {
    document.getElementById('add-friend-modal').classList.remove('hidden');
}

// Group functionality completely removed

async function showBlockedUsers() {
    try {
        // Ensure user is logged in
        if (!currentUser || !currentUser.id) {
            showError('Please log in first');
            return;
        }

        // Get blocked users with proper error handling
        const { data: blockedUsers, error: blockedError } = await supabase
            .from('blocked_users')
            .select('id, blocker_id, blocked_id, reason, created_at')
            .eq('blocker_id', currentUser.id);

        if (blockedError) {
            console.error('Error fetching blocked users:', blockedError);

            // Check if table doesn't exist or permission issue
            if (blockedError.code === '42P01' || blockedError.message.includes('does not exist')) {
                showError('Blocked users feature is not available. Please contact support.');
            } else if (blockedError.code === '42501' || blockedError.message.includes('permission denied')) {
                showError('Permission error. Please try logging out and back in.');
            } else {
                showError('Unable to load blocked users. Please try again later.');
            }
            return;
        }

        const blockedUsersList = document.getElementById('blocked-users-list');
        blockedUsersList.innerHTML = '';

        if (!blockedUsers || blockedUsers.length === 0) {
            blockedUsersList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-user-check" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No Blocked Users</h3>
                    <p>You haven't blocked anyone yet.</p>
                </div>
            `;
        } else {
            // Get blocked user profiles
            const blockedIds = blockedUsers.map(blocked => blocked.blocked_id);
            const { data: profiles, error: profileError } = await supabase
                .from('user_profiles')
                .select('full_name, username, avatar_url, user_id')
                .in('user_id', blockedIds);

            if (profileError) {
                console.error('Error fetching profiles:', profileError);
                showError('Error loading user profiles');
                return;
            }

            blockedUsers.forEach(blockedUser => {
                const user = profiles.find(profile => profile.user_id === blockedUser.blocked_id);
                if (!user) return;

                const userElement = document.createElement('div');
                userElement.className = 'blocked-user-item';

                const avatar = user.avatar_url 
                    ? `<img src="${user.avatar_url}" alt="${user.full_name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` 
                    : `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-gradient); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${user.full_name.charAt(0).toUpperCase()}</div>`;

                const blockedDate = new Date(blockedUser.created_at).toLocaleDateString();

                userElement.innerHTML = `
                    <div class="blocked-user-info" style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        ${avatar}
                        <div class="user-details">
                            <div class="user-name" style="color: var(--text-primary); font-weight: 600;">${user.full_name}</div>
                            <div class="user-username" style="color: var(--text-secondary); font-size: 14px;">@${user.username}</div>
                            <div class="blocked-date" style="color: var(--text-secondary); font-size: 12px;">Blocked on ${blockedDate}</div>
                            ${blockedUser.reason ? `<div class="block-reason" style="color: var(--text-secondary); font-size: 12px; font-style: italic;">"${blockedUser.reason}"</div>` : ''}
                        </div>
                    </div>
                    <button class="unblock-button" onclick="unblockUser('${blockedUser.id}')" style="background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 2px solid rgba(34, 197, 94, 0.3); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s ease; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-unlock"></i> Unblock
                    </button>
                `;

                userElement.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 12px; margin-bottom: 10px; border: 1px solid rgba(255, 255, 255, 0.1);';

                blockedUsersList.appendChild(userElement);
            });
        }

        document.getElementById('blocked-users-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading blocked users:', error);
        showError('Error loading blocked users: ' + error.message);
    }
}

async function unblockUser(blockedUserId) {
    try {
        const { error } = await supabase
            .from('blocked_users')
            .delete()
            .eq('id', blockedUserId);

        if (error) {
            console.error('Error unblocking user:', error);
            showError('Error unblocking user: ' + error.message);
            return;
        }

        showError('User unblocked successfully!', 'success');

        // Refresh the blocked users list
        setTimeout(async () => {
            await showBlockedUsers();
        }, 500);
    } catch (error) {
        console.error('Error unblocking user:', error);
        showError('Error unblocking user: ' + error.message);
    }
}

async function blockUser() {
    if (!activeChat || activeChatType !== 'user') {
        showError('Please select a user conversation first');
        return;
    }

    try {
        const { error } = await supabase
            .from('blocked_users')
            .insert([{
                blocker_id: currentUser.id,
                blocked_id: activeChat.user_id,
                reason: 'Blocked from conversation'
            }]);

        if (error) throw error;

        showError('User blocked successfully!', 'success');
        closeModal('user-profile-modal');

        // Reload friends to remove blocked user
        await loadFriends();
    } catch (error) {
        showError('Error blocking user: ' + error.message);
    }
}

// Settings functions
function showSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
    loadUserSettings();
}

async function loadUserSettings() {
    try {
        // Load user settings from user_settings table
        const { data: settings, error: settingsError } = await supabase
            .from('user_settings')
            .select('theme, notifications_enabled, sound_enabled')
            .eq('user_id', currentUser.id)
            .single();

        // Load profile visibility from user_profiles table
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('profile_visibility')
            .eq('user_id', currentUser.id)
            .single();

        if (settingsError) {
            console.error('Error loading settings:', settingsError);
            // Create default settings if none exist
            const { error: insertError } = await supabase
                .from('user_settings')
                .insert([{
                    user_id: currentUser.id,
                    theme: 'dark',
                    notifications_enabled: true,
                    sound_enabled: true
                }]);

            if (insertError) {
                console.error('Error creating default settings:', insertError);
                showError('Error loading settings');
                return;
            }

            // Set default values in UI
            document.getElementById('notifications-enabled').checked = true;
            document.getElementById('sound-enabled').checked = true;
        } else {
            // Load settings into UI
            document.getElementById('notifications-enabled').checked = settings.notifications_enabled;
            document.getElementById('sound-enabled').checked = settings.sound_enabled;
        }

        // Handle profile visibility separately
        if (profileError) {
            console.error('Error loading profile visibility:', profileError);
            document.getElementById('profile-visibility').value = 'public';
        } else {
            document.getElementById('profile-visibility').value = profile.profile_visibility || 'public';
        }

        // Load profile data
        if (currentUserProfile) {
            document.getElementById('settings-bio').value = currentUserProfile.bio || '';

            // Load profile picture
            const profileAvatar = document.getElementById('profile-avatar');
            if (profileAvatar) {
                if (currentUserProfile.avatar_url) {
                    profileAvatar.innerHTML = `<img src="${currentUserProfile.avatar_url}" alt="Profile Picture">`;
                } else {
                    profileAvatar.innerHTML = currentUserProfile.full_name.charAt(0).toUpperCase();
                }
            }
        }

        // Always refresh user profile to ensure we have the latest username
        await loadUserProfile();

        // Update username field with current profile data - this should always show the username
        const usernameField = document.getElementById('settings-username');
        if (usernameField && currentUserProfile) {
            if (currentUserProfile.username && currentUserProfile.username !== '' && currentUserProfile.username !== 'undefined') {
                usernameField.value = currentUserProfile.username;
                usernameField.style.color = '#667eea';
                usernameField.style.fontWeight = '600';
            } else {
                usernameField.value = 'Generating username...';
                usernameField.style.color = '#fbbf24';
                usernameField.style.fontWeight = '400';

                // Try to generate username if missing
                try {
                    await ensureUserHasUsername();

                    // Reload after generation
                    setTimeout(async () => {
                        await loadUserProfile();
                        if (currentUserProfile && currentUserProfile.username && currentUserProfile.username !== 'undefined') {
                            usernameField.value = currentUserProfile.username;
                            usernameField.style.color = '#667eea';
                            usernameField.style.fontWeight = '600';
                        } else {
                            usernameField.value = 'Username assignment failed';
                            usernameField.style.color = '#ef4444';
                            usernameField.style.fontWeight = '400';
                        }
                    }, 2000);
                } catch (error) {
                    console.error('Error generating username:', error);
                    usernameField.value = 'Username generation failed';
                    usernameField.style.color = '#ef4444';
                    usernameField.style.fontWeight = '400';
                }
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Profile picture functions
function selectProfilePicture() {
    document.getElementById('profile-picture-input').click();
}

async function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Ensure we have a current user and profile
    if (!currentUser) {
        showError('Please log in first');
        return;
    }

    if (!currentUserProfile) {
        showError('Profile not loaded. Please try again.');
        await loadUserProfile();
        return;
    }

    // Validate file size (max 5MB for profile pictures)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showError('Profile picture must be less than 5MB');
        return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showError('Please upload a valid image (JPEG, PNG, GIF, WebP)');
        return;
    }

    try {
        showError('Uploading profile picture...', 'success');

        // Create unique filename for profile picture
        const fileExtension = file.name.split('.').pop();
        const fileName = `${currentUser.id}/profile_${Date.now()}.${fileExtension}`;

        // Upload file to Supabase Storage
        const { data, error } = await supabase.storage
            .from('media')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(fileName);

        // Update user profile with new avatar URL
        const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ avatar_url: publicUrl })
            .eq('user_id', currentUser.id);

        if (updateError) throw updateError;

        // Update current profile data
        if (currentUserProfile) {
            currentUserProfile.avatar_url = publicUrl;
        }

        // Update avatar in settings modal
        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            profileAvatar.innerHTML = `<img src="${publicUrl}" alt="Profile Picture" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }

        // Update avatar in header
        const headerAvatar = document.getElementById('user-avatar');
        if (headerAvatar) {
            headerAvatar.innerHTML = `<img src="${publicUrl}" alt="Profile Picture" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }

        showError('Profile picture updated successfully!', 'success');
    } catch (error) {
        showError('Error uploading profile picture: ' + error.message);
    } finally {
        // Clear the file input
        event.target.value = '';
    }
}

// Cancel chat function - returns to homepage
function cancelCurrentChat() {
    activeChat = null;
    activeChatType = null;

    // Clear chat messages and show welcome message
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = `
        <div class="welcome-message" id="welcome-message">
            <div style="text-align: center; padding: 50px; color: rgba(255,255,255,0.6);">
                <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>Welcome to ZAO</h3>
                <p>Select a conversation to start chatting</p>
            </div>
        </div>
    `;
    chatMessages.style.display = 'flex'; // Ensure it's visible

    // Update chat header to homepage state
    const chatHeader = document.querySelector('.chat-header h2');
    chatHeader.textContent = 'Select a conversation';

    // Disable message input
    document.getElementById('message-input').disabled = true;
    document.getElementById('message-input').placeholder = 'Select a conversation to start messaging...';
    document.getElementById('send-button').disabled = true;

    // Hide cancel button when no conversation is active
    const cancelButton = document.querySelector('.cancel-chat-button');
    if (cancelButton) {
        cancelButton.classList.add('hidden');
    }

    // Remove active state from all chat items
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });

    // Ensure we're on the Chats tab (homepage)
    showChats();

    // Close sidebar on mobile if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth < 768) {
        sidebar.classList.remove('open');
    }
}

async function saveSettings() {
    const notificationsEnabled = document.getElementById('notifications-enabled').checked;
    const soundEnabled = document.getElementById('sound-enabled').checked;
    const profileVisibility = document.getElementById('profile-visibility').value;
    const bio = document.getElementById('settings-bio').value;

    try {
        // Update user settings
        const { error: settingsError } = await supabase
            .from('user_settings')
            .upsert({
                user_id: currentUser.id,
                theme: 'dark', // Assuming theme is always dark for now
                notifications_enabled: notificationsEnabled,
                sound_enabled: soundEnabled,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (settingsError) throw settingsError;

        // Update profile settings in user_profiles table
        const { error: profileError } = await supabase
            .from('user_profiles')
            .update({
                profile_visibility: profileVisibility,
                bio: bio,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', currentUser.id);

        if (profileError) throw profileError;

        // Update current profile data
        if (currentUserProfile) {
            currentUserProfile.profile_visibility = profileVisibility;
            currentUserProfile.bio = bio;
        }

        showError('Settings saved successfully!', 'success');
        closeModal('settings-modal');
    } catch (error) {
        showError('Error saving settings: ' + error.message);
    }
}

// Send friend request from settings
async function sendFriendRequestFromSettings() {
    const username = document.getElementById('invite-username').value.trim();

    if (!username) {
        showError('Please enter a username');
        return;
    }

    try {
        // Find user by username
        const { data: targetUser, error: userError } = await supabase
            .from('user_profiles')
            .select('user_id, username, full_name, is_verified, verification_type')
            .eq('username', username)
            .single();

        if (userError || !targetUser) {
            showError('User not found');
            return;
        }

        if (targetUser.user_id === currentUser.id) {
            showError('You cannot send a friend request to yourself');
            return;
        }

        // Check if friendship already exists
        const { data: existingFriendship, error: checkError } = await supabase
            .from('friendships')
            .select('*')
            .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${targetUser.user_id}),and(requester_id.eq.${targetUser.user_id},addressee_id.eq.${currentUser.id})`)
            .single();

        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                showError('You are already friends with this user');
            } else if (existingFriendship.status === 'pending') {
                showError('Friend request already sent');
            }
            return;
        }

        // Send friend request
        const { error: requestError } = await supabase
            .from('friendships')
            .insert([
                {
                    requester_id: currentUser.id,
                    addressee_id: targetUser.user_id,
                    status: 'pending'
                }
            ]);

        if (requestError) throw requestError;

        showError(`Friend request sent to ${targetUser.full_name}!`, 'success');
        document.getElementById('invite-username').value = '';

    } catch (error) {
        showError('Error sending friend request: ' + error.message);
    }
}

// Utility functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function showError(message, type = 'error') {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;

    // Handle different message types
    let className = 'error-message';
    if (type === 'success') {
        className += ' success-message';
    } else if (type === 'info') {
        className += ' info-message';
    }

    errorElement.className = className;
    errorElement.classList.remove('hidden');

    // Auto-hide after 5 seconds for errors, 3 seconds for success/info
    const hideDelay = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        errorElement.classList.add('hidden');
    }, hideDelay);
}

function openImageModal(imageUrl) {
    // Create and show image modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.onclick = () => modal.remove();
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 80%; max-height: 80%;">
            <img src="${imageUrl}" style="width: 100%; height: auto; border-radius: 10px;">
        </div>
    `;
    document.body.appendChild(modal);
}

// New function to request verification
async function requestVerification() {
    try {
        if (!currentUser || !currentUser.id) {
            showError('Please log in to request verification.', 'error');
            return;
        }

        // Check if user is already verified by admin
        if (currentUserProfile && currentUserProfile.is_verified && currentUserProfile.verification_type && currentUserProfile.verification_type !== 'email') {
            showError('Your account is already verified!', 'success');
            return;
        }

        // Create verification request
        const { data, error } = await supabase
            .from('verification_requests')
            .insert([{
                user_id: currentUser.id,
                verification_type: 'verified',
                status: 'pending',
                request_reason: 'User requested verification through settings'
            }])
            .select();

        if (error) {
            console.error('Error submitting verification request:', error);
            showError('Verification is handled by administrators only. Please contact support for verification requests.', 'info');
            return;
        }

        showError('Verification request submitted! Administrators will review your request.', 'success');

    } catch (error) {
        console.error('Error requesting verification:', error);
        showError('Verification is handled by administrators only. Please contact support for verification requests.', 'info');
    }
}

// Helper function to format last seen time
function formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Offline';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
        return 'Just now';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
        return `${diffInDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Display a message with proper sender/receiver positioning
function displayMessage(message) {
    const messagesContainer = document.getElementById('chat-messages');

    // Check if message already exists to prevent duplicates
    const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
    if (existingMessage) {
        return; // Message already displayed
    }

    const isOwnMessage = message.user_id === currentUser.id;
    
    // Create message wrapper
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';
    messageWrapper.setAttribute('data-message-id', message.id);
    messageWrapper.style.cssText = `
        display: flex;
        width: 100%;
        margin-bottom: 16px;
        justify-content: ${isOwnMessage ? 'flex-end' : 'flex-start'};
    `;

    // Create message bubble
    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble ${isOwnMessage ? 'own-bubble' : 'other-bubble'}`;
    
    // Style the bubble
    if (isOwnMessage) {
        messageBubble.style.cssText = `
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 12px 16px;
            border-radius: 18px 18px 4px 18px;
            max-width: 75%;
            position: relative;
            word-wrap: break-word;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            margin-left: auto;
        `;
    } else {
        messageBubble.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
            padding: 12px 16px;
            border-radius: 18px 18px 18px 4px;
            max-width: 75%;
            position: relative;
            word-wrap: break-word;
            border: 1px solid rgba(255, 255, 255, 0.1);
            margin-right: auto;
        `;
    }

    const messageTime = new Date(message.created_at).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // Show sender name for received messages
    let senderHtml = '';
    if (!isOwnMessage && message.user_profiles) {
        const verificationBadge = getVerificationBadge(message.user_profiles);
        senderHtml = `
            <div class="message-sender" style="font-size: 12px; font-weight: 600; color: #667eea; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                ${message.user_profiles.full_name} ${verificationBadge}
            </div>
        `;
    }

    // Build content based on message type
    let contentHtml = '';
    if (message.message_type === 'text' || !message.message_type) {
        contentHtml = `<div class="message-text" style="font-size: 16px; line-height: 1.4;">${message.content}</div>`;
    } else if (message.message_type === 'image') {
        contentHtml = `
            ${message.content ? `<div class="message-text" style="font-size: 16px; line-height: 1.4; margin-bottom: 8px;">${message.content}</div>` : ''}
            <img src="${message.media_url}" class="message-media" alt="Image" onclick="openImageModal('${message.media_url}')" style="max-width: 100%; max-height: 300px; border-radius: 12px; cursor: pointer; transition: transform 0.2s ease;">
        `;
    } else if (message.message_type === 'video') {
        contentHtml = `
            ${message.content ? `<div class="message-text" style="font-size: 16px; line-height: 1.4; margin-bottom: 8px;">${message.content}</div>` : ''}
            <video src="${message.media_url}" class="message-media" controls style="max-width: 100%; max-height: 300px; border-radius: 12px;">
        `;
    }

    // Read status for sent messages
    let readStatusHtml = '';
    if (isOwnMessage && message.is_read) {
        readStatusHtml = '<span class="read-status" style="color: #22c55e; font-weight: bold; margin-left: 8px;">✓✓</span>';
    }

    // Assemble the message bubble
    messageBubble.innerHTML = `
        ${senderHtml}
        ${contentHtml}
        <div class="message-footer" style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; font-size: 11px; opacity: 0.7;">
            <span class="message-time">${messageTime}</span>
            ${readStatusHtml}
        </div>
    `;

    messageWrapper.appendChild(messageBubble);
    messagesContainer.appendChild(messageWrapper);

    // Auto-scroll to bottom
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
}

// Update online status indicators in real-time
function updateOnlineStatusInRealTime(userProfile) {
    console.log('Updating online status for user:', userProfile.user_id, 'Status:', userProfile.is_online);

    const userItems = document.querySelectorAll(`[data-user-id="${userProfile.user_id}"]`);

    userItems.forEach(item => {
        const avatar = item.querySelector('.user-avatar');
        if (avatar) {
            // Remove existing status indicators
            const existingIndicator = avatar.querySelector('.status-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }

            // Add new status indicator
            const statusIndicator = document.createElement('div');
            statusIndicator.className = `status-indicator ${userProfile.is_online ? 'online' : 'offline'}`;
            avatar.style.position = 'relative';
            avatar.appendChild(statusIndicator);
        }

        // Update online/offline text
        const userDetails = item.querySelector('.user-details');
        if (userDetails) {
            let onlineText = userDetails.querySelector('.online-text');
            let offlineText = userDetails.querySelector('.offline-text');

            // Remove existing status text
            if (onlineText) onlineText.remove();
            if (offlineText) offlineText.remove();

            const statusText = document.createElement('div');
            statusText.className = userProfile.is_online ? 'online-text' : 'offline-text';
            statusText.textContent = userProfile.is_online ? 'Online' : formatLastSeen(userProfile.last_seen);
            userDetails.appendChild(statusText);
        }
    });
}

// Refresh online status indicators for all visible users
async function refreshOnlineStatusIndicators() {
    if (!currentUser) return;

    try {
        // Get all visible user elements in the friends list and chat list
        const userElements = document.querySelectorAll('[data-user-id]');
        const userIds = Array.from(userElements).map(el => el.dataset.userId);

        if (userIds.length === 0) return;

        // Fetch current online status for all visible users
        const { data: userProfiles, error } = await supabase
            .from('user_profiles')
            .select('user_id, is_online, last_seen')
            .in('user_id', userIds);

        if (error) {
            console.error('Error fetching user statuses:', error);
            return;
        }

        // Update each user's status indicator
        userProfiles.forEach(profile => {
            updateOnlineStatusInRealTime(profile);
        });

    } catch (error) {
        console.error('Error refreshing online status indicators:', error);
    }
}

// Create notification for a user
async function createNotification(userId, type, title, body) {
    try {
        await supabase.from('notifications').insert([
            { user_id: userId, type: type, title: title, body: body, is_read: false, created_at: new Date().toISOString() }
        ]);
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

// Placeholder for loading notifications (if needed)
async function loadNotifications() {
    // Implementation for fetching and displaying notifications
    // This might involve fetching from the 'notifications' table and updating a UI element
}

// Placeholder for showing in-app notification
function showInAppNotification(notification) {
    // Implementation for showing a toast/banner notification within the app
    // This could use the `showLocalNotification` function or a custom modal
    console.log('In-app notification:', notification);
    if (Notification.permission === 'granted') {
        showLocalNotification(notification.title, notification.body, { type: notification.type, sender_id: notification.user_id });
    }
}