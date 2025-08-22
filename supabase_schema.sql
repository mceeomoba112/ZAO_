
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT,
    bio TEXT,
    avatar_url TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'friends', 'private')),
    is_verified BOOLEAN DEFAULT false,
    verification_type TEXT CHECK (verification_type IN ('verified', 'creator', 'admin', 'premium')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user settings table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    notifications_enabled BOOLEAN DEFAULT true,
    sound_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    addressee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video')),
    media_url TEXT,
    media_type TEXT,
    media_size BIGINT,
    media_name TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create verification requests table
CREATE TABLE IF NOT EXISTS verification_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_id UUID REFERENCES auth.users(id)
);

-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    admin_level TEXT DEFAULT 'admin' CHECK (admin_level IN ('admin', 'super_admin', 'moderator')),
    permissions TEXT[] DEFAULT ARRAY['moderate_users', 'delete_messages', 'assign_verification'],
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create user restrictions table for banning/restrictions
CREATE TABLE IF NOT EXISTS user_restrictions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    restricted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    restriction_type TEXT DEFAULT 'ban' CHECK (restriction_type IN ('ban', 'mute', 'suspend', 'warning')),
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create early access features table
CREATE TABLE IF NOT EXISTS early_access_features (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    feature_name TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled_for TEXT[] DEFAULT ARRAY['premium', 'creator', 'admin'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create creators table
CREATE TABLE IF NOT EXISTS creators (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    creator_type TEXT DEFAULT 'creator' CHECK (creator_type IN ('creator', 'founder', 'developer', 'owner')),
    special_permissions TEXT[] DEFAULT ARRAY['all_access', 'system_admin'],
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create premium users table
CREATE TABLE IF NOT EXISTS premium_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    premium_type TEXT DEFAULT 'premium' CHECK (premium_type IN ('premium', 'premium_plus', 'lifetime')),
    features TEXT[] DEFAULT ARRAY['unlimited_storage', 'priority_support', 'custom_themes'],
    expires_at TIMESTAMP WITH TIME ZONE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create function to assign creator badge (for app owner)
CREATE OR REPLACE FUNCTION assign_creator_badge(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert into creators table
    INSERT INTO creators (user_id, creator_type, special_permissions)
    VALUES (target_user_id, 'founder', ARRAY['all_access', 'system_admin', 'user_management', 'ban_users', 'auto_friendship'])
    ON CONFLICT (user_id) DO UPDATE SET
        creator_type = 'founder',
        special_permissions = ARRAY['all_access', 'system_admin', 'user_management', 'ban_users', 'auto_friendship'],
        is_active = true;
    
    -- Update user profile verification
    UPDATE user_profiles 
    SET 
        is_verified = true,
        verification_type = 'creator',
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    -- Auto-friend all existing users with the creator
    INSERT INTO friendships (requester_id, addressee_id, status)
    SELECT target_user_id, user_id, 'accepted'
    FROM user_profiles 
    WHERE user_id != target_user_id
    ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'accepted';
    
    -- Also create reverse friendships
    INSERT INTO friendships (requester_id, addressee_id, status)
    SELECT user_id, target_user_id, 'accepted'
    FROM user_profiles 
    WHERE user_id != target_user_id
    ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'accepted';
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create function to assign premium badge
CREATE OR REPLACE FUNCTION assign_premium_badge(target_user_id UUID, premium_type_param TEXT DEFAULT 'premium')
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert into premium users table
    INSERT INTO premium_users (user_id, premium_type, expires_at)
    VALUES (target_user_id, premium_type_param, NOW() + INTERVAL '1 year')
    ON CONFLICT (user_id) DO UPDATE SET
        premium_type = premium_type_param,
        expires_at = NOW() + INTERVAL '1 year',
        is_active = true;
    
    -- Update user profile verification
    UPDATE user_profiles 
    SET 
        is_verified = true,
        verification_type = 'premium',
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create function to assign admin badge
CREATE OR REPLACE FUNCTION assign_admin_badge(target_user_id UUID, admin_level_param TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert into admin users table
    INSERT INTO admin_users (user_id, admin_level)
    VALUES (target_user_id, admin_level_param)
    ON CONFLICT (user_id) DO UPDATE SET
        admin_level = admin_level_param,
        is_active = true;
    
    -- Update user profile verification
    UPDATE user_profiles 
    SET 
        is_verified = true,
        verification_type = 'admin',
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create function to assign regular verified badge
CREATE OR REPLACE FUNCTION assign_verified_badge(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update user profile verification
    UPDATE user_profiles 
    SET 
        is_verified = true,
        verification_type = 'verified',
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create function to remove verification badge
CREATE OR REPLACE FUNCTION remove_verification_badge(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Remove from all verification tables
    DELETE FROM admin_users WHERE user_id = target_user_id;
    DELETE FROM creators WHERE user_id = target_user_id;
    DELETE FROM premium_users WHERE user_id = target_user_id;
    
    -- Update user profile
    UPDATE user_profiles 
    SET 
        is_verified = false,
        verification_type = NULL,
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to ban/restrict users (creator/admin only)
CREATE OR REPLACE FUNCTION restrict_user(
    target_user_id UUID,
    admin_user_id UUID,
    restriction_type_param TEXT DEFAULT 'ban',
    reason_param TEXT DEFAULT NULL,
    expires_param TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    can_restrict BOOLEAN := false;
BEGIN
    -- Check if admin has permission to restrict users
    SELECT true INTO can_restrict
    FROM creators c
    WHERE c.user_id = admin_user_id 
    AND c.is_active = true
    AND 'ban_users' = ANY(c.special_permissions);
    
    IF NOT can_restrict THEN
        SELECT true INTO can_restrict
        FROM admin_users a
        WHERE a.user_id = admin_user_id 
        AND a.is_active = true
        AND 'moderate_users' = ANY(a.permissions);
    END IF;
    
    IF NOT can_restrict THEN
        RAISE EXCEPTION 'User does not have permission to restrict other users';
    END IF;
    
    -- Insert restriction
    INSERT INTO user_restrictions (user_id, restricted_by, restriction_type, reason, expires_at)
    VALUES (target_user_id, admin_user_id, restriction_type_param, reason_param, expires_param);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function for admins to assign verification badges
CREATE OR REPLACE FUNCTION admin_assign_verification(
    target_user_id UUID,
    admin_user_id UUID,
    verification_type_param TEXT DEFAULT 'verified'
)
RETURNS BOOLEAN AS $$
DECLARE
    can_verify BOOLEAN := false;
BEGIN
    -- Check if admin has permission to assign verification
    SELECT true INTO can_verify
    FROM admin_users a
    WHERE a.user_id = admin_user_id 
    AND a.is_active = true
    AND 'assign_verification' = ANY(a.permissions);
    
    IF NOT can_verify THEN
        SELECT true INTO can_verify
        FROM creators c
        WHERE c.user_id = admin_user_id 
        AND c.is_active = true;
    END IF;
    
    IF NOT can_verify THEN
        RAISE EXCEPTION 'User does not have permission to assign verification';
    END IF;
    
    -- Assign verification based on type
    CASE verification_type_param
        WHEN 'verified' THEN
            PERFORM assign_verified_badge(target_user_id);
        WHEN 'premium' THEN
            PERFORM assign_premium_badge(target_user_id);
        WHEN 'admin' THEN
            PERFORM assign_admin_badge(target_user_id);
        ELSE
            PERFORM assign_verified_badge(target_user_id);
    END CASE;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Auto-friendship trigger for new users with creators
CREATE OR REPLACE FUNCTION auto_friend_creators()
RETURNS TRIGGER AS $$
DECLARE
    creator_id UUID;
BEGIN
    -- Get all creators/founders
    FOR creator_id IN 
        SELECT user_id FROM creators WHERE is_active = true AND 'auto_friendship' = ANY(special_permissions)
    LOOP
        -- Create friendship from creator to new user
        INSERT INTO friendships (requester_id, addressee_id, status)
        VALUES (creator_id, NEW.user_id, 'accepted')
        ON CONFLICT (requester_id, addressee_id) DO NOTHING;
        
        -- Create friendship from new user to creator
        INSERT INTO friendships (requester_id, addressee_id, status)
        VALUES (NEW.user_id, creator_id, 'accepted')
        ON CONFLICT (requester_id, addressee_id) DO NOTHING;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-friending creators
CREATE TRIGGER trigger_auto_friend_creators
    AFTER INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_friend_creators();

-- Function to check early access features
CREATE OR REPLACE FUNCTION has_early_access(user_id_param UUID, feature_name_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_verification TEXT;
    feature_permissions TEXT[];
BEGIN
    -- Get user verification type
    SELECT verification_type INTO user_verification
    FROM user_profiles
    WHERE user_id = user_id_param;
    
    -- Get feature permissions
    SELECT enabled_for INTO feature_permissions
    FROM early_access_features
    WHERE feature_name = feature_name_param AND is_active = true;
    
    -- Check if user has access
    RETURN user_verification = ANY(feature_permissions);
END;
$$ LANGUAGE plpgsql;

-- Create function to generate unique usernames
CREATE OR REPLACE FUNCTION generate_unique_username()
RETURNS TEXT AS $$
DECLARE
    new_username TEXT;
    counter INTEGER := 0;
BEGIN
    LOOP
        counter := counter + 1;
        new_username := 'ZAO_' || LPAD(floor(random() * 999999)::text, 6, '0');
        
        -- Check if username exists
        IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE username = new_username) THEN
            RETURN new_username;
        END IF;
        
        -- Prevent infinite loop
        IF counter > 1000 THEN
            new_username := 'ZAO_' || extract(epoch from now())::bigint::text;
            RETURN new_username;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to ensure user has username
CREATE OR REPLACE FUNCTION ensure_user_has_username(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    current_username TEXT;
    new_username TEXT;
BEGIN
    -- Get current username
    SELECT username INTO current_username FROM user_profiles WHERE user_id = user_uuid;
    
    -- If username is null or empty, generate new one
    IF current_username IS NULL OR current_username = '' THEN
        new_username := generate_unique_username();
        
        UPDATE user_profiles 
        SET username = new_username, updated_at = NOW()
        WHERE user_id = user_uuid;
        
        RETURN new_username;
    END IF;
    
    RETURN current_username;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate username on user profile creation
CREATE OR REPLACE FUNCTION auto_generate_username()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.username IS NULL OR NEW.username = '' THEN
        NEW.username := generate_unique_username();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_username
    BEFORE INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_username();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view public profiles" ON user_profiles
    FOR SELECT USING (profile_visibility = 'public' OR user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- User settings policies
CREATE POLICY "Users can manage own settings" ON user_settings
    FOR ALL USING (user_id = auth.uid());

-- Friendships policies
CREATE POLICY "Users can view own friendships" ON friendships
    FOR SELECT USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE POLICY "Users can create friendships" ON friendships
    FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can update own friendships" ON friendships
    FOR UPDATE USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (user_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own messages" ON messages
    FOR UPDATE USING (user_id = auth.uid() OR recipient_id = auth.uid());

-- Blocked users policies
CREATE POLICY "Users can manage own blocked list" ON blocked_users
    FOR ALL USING (blocker_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users can manage own notifications" ON notifications
    FOR ALL USING (user_id = auth.uid());

-- Verification requests policies
CREATE POLICY "Users can manage own verification requests" ON verification_requests
    FOR ALL USING (user_id = auth.uid());

-- Enable RLS on verification tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE early_access_features ENABLE ROW LEVEL SECURITY;

-- Admin users policies (readable by all, manageable by admins only)
CREATE POLICY "Anyone can view admin users" ON admin_users
    FOR SELECT USING (true);

CREATE POLICY "Only super admins can manage admin users" ON admin_users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND admin_level = 'super_admin' 
            AND is_active = true
        )
    );

-- Creators policies (readable by all)
CREATE POLICY "Anyone can view creators" ON creators
    FOR SELECT USING (true);

CREATE POLICY "Only creators can manage creators table" ON creators
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM creators 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Premium users policies (readable by all, manageable by user and admins)
CREATE POLICY "Anyone can view premium users" ON premium_users
    FOR SELECT USING (true);

CREATE POLICY "Users and admins can manage premium status" ON premium_users
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- User restrictions policies
CREATE POLICY "Users can view own restrictions" ON user_restrictions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins and creators can view all restrictions" ON user_restrictions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND is_active = true
        ) OR
        EXISTS (
            SELECT 1 FROM creators 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

CREATE POLICY "Admins and creators can manage restrictions" ON user_restrictions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND is_active = true
        ) OR
        EXISTS (
            SELECT 1 FROM creators 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Early access features policies
CREATE POLICY "Anyone can view early access features" ON early_access_features
    FOR SELECT USING (true);

CREATE POLICY "Only creators can manage early access features" ON early_access_features
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM creators 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Storage policies for media bucket
-- You need to create a bucket named "media" in Supabase Storage first

-- Allow authenticated users to upload files to their own folder
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'media' 
        AND auth.role() = 'authenticated' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy to allow users to view/download their own files and public files
CREATE POLICY "Users can view own files and public files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'media' 
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR auth.role() = 'authenticated'
        )
    );

-- Policy to allow users to update their own files
CREATE POLICY "Users can update own files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'media' 
        AND auth.role() = 'authenticated' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy to allow users to delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'media' 
        AND auth.role() = 'authenticated' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(requester_id, addressee_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(user_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);
