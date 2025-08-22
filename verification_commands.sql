
-- ZAO Chat Verification Badge Assignment Commands
-- Copy and paste these commands into your Supabase SQL editor

-- =================================================================
-- ASSIGN ALL BADGES TO SPECIFIC USER: cdb6612c-06d4-4512-a0fa-1f26fd72f8b8
-- =================================================================

-- 1. Assign CREATOR/FOUNDER badge (highest privilege)
SELECT assign_creator_badge('cdb6612c-06d4-4512-a0fa-1f26fd72f8b8');

-- 2. Also assign ADMIN badge for moderation capabilities
SELECT assign_admin_badge('cdb6612c-06d4-4512-a0fa-1f26fd72f8b8', 'super_admin');

-- 3. Also assign PREMIUM badge for premium features
SELECT assign_premium_badge('cdb6612c-06d4-4512-a0fa-1f26fd72f8b8', 'lifetime');

-- 4. Ensure verified status (should already be set by creator badge)
SELECT assign_verified_badge('cdb6612c-06d4-4512-a0fa-1f26fd72f8b8');

-- =================================================================
-- USAGE EXAMPLES FOR OTHER COMMANDS
-- =================================================================

-- Ban a user (creator/admin only):
-- SELECT restrict_user('TARGET_USER_ID', 'cdb6612c-06d4-4512-a0fa-1f26fd72f8b8', 'ban', 'Violation of terms', NULL);

-- Temporarily suspend a user for 7 days:
-- SELECT restrict_user('TARGET_USER_ID', 'cdb6612c-06d4-4512-a0fa-1f26fd72f8b8', 'suspend', 'Temporary suspension', NOW() + INTERVAL '7 days');

-- Admin assigns verification to a user:
-- SELECT admin_assign_verification('TARGET_USER_ID', 'cdb6612c-06d4-4512-a0fa-1f26fd72f8b8', 'verified');

-- Check if user has early access to a feature:
-- SELECT has_early_access('TARGET_USER_ID', 'beta_messaging');

-- =================================================================
-- EARLY ACCESS FEATURES SETUP
-- =================================================================

-- Add some early access features for premium users
INSERT INTO early_access_features (feature_name, description, enabled_for) VALUES
('beta_messaging', 'Advanced messaging features', ARRAY['premium', 'creator', 'admin']),
('custom_themes', 'Custom theme support', ARRAY['premium', 'creator']),
('priority_support', 'Priority customer support', ARRAY['premium', 'creator', 'admin']),
('admin_panel', 'Administrative panel access', ARRAY['creator', 'admin']),
('advanced_search', 'Advanced user search', ARRAY['premium', 'creator', 'admin'])
ON CONFLICT (feature_name) DO NOTHING;

-- =================================================================
-- CLEAN UP EMAIL VERIFICATION (Remove from regular users)
-- =================================================================

-- Remove email verification from all users (this should only be set by admins)
UPDATE user_profiles 
SET 
    is_verified = false,
    verification_type = NULL,
    updated_at = NOW()
WHERE verification_type = 'email';

-- =================================================================
-- VERIFICATION STATUS CHECK
-- =================================================================

-- Check the verification status of the specific user
SELECT 
    up.user_id,
    up.full_name,
    up.username,
    up.email,
    up.is_verified,
    up.verification_type,
    CASE 
        WHEN c.user_id IS NOT NULL THEN 'Creator/Founder 👑'
        WHEN a.user_id IS NOT NULL THEN 'Admin 🔰 (' || a.admin_level || ')'
        WHEN p.user_id IS NOT NULL THEN 'Premium 💎 (' || p.premium_type || ')'
        ELSE 'Regular User'
    END as badge_type,
    CASE
        WHEN c.user_id IS NOT NULL THEN c.special_permissions
        WHEN a.user_id IS NOT NULL THEN a.permissions
        WHEN p.user_id IS NOT NULL THEN p.features
        ELSE NULL
    END as special_privileges
FROM user_profiles up
LEFT JOIN creators c ON up.user_id = c.user_id AND c.is_active = true
LEFT JOIN admin_users a ON up.user_id = a.user_id AND a.is_active = true  
LEFT JOIN premium_users p ON up.user_id = p.user_id AND p.is_active = true
WHERE up.user_id = 'cdb6612c-06d4-4512-a0fa-1f26fd72f8b8';

-- =================================================================
-- VIEW ALL VERIFICATION STATUSES
-- =================================================================

-- Get all users and their verification status:
SELECT 
    up.user_id,
    up.full_name,
    up.username,
    up.email,
    up.is_verified,
    up.verification_type,
    CASE 
        WHEN c.user_id IS NOT NULL THEN 'Creator 👑'
        WHEN a.user_id IS NOT NULL THEN 'Admin 🔰'
        WHEN p.user_id IS NOT NULL THEN 'Premium 💎'
        WHEN up.is_verified THEN 'Verified ✅'
        ELSE 'Regular User'
    END as badge_type
FROM user_profiles up
LEFT JOIN creators c ON up.user_id = c.user_id AND c.is_active = true
LEFT JOIN admin_users a ON up.user_id = a.user_id AND a.is_active = true  
LEFT JOIN premium_users p ON up.user_id = p.user_id AND p.is_active = true
ORDER BY up.created_at;

-- =================================================================
-- MANAGEMENT COMMANDS
-- =================================================================

-- Remove all verifications from a user:
-- SELECT remove_verification_badge('TARGET_USER_ID');

-- View all restricted users:
-- SELECT 
--     ur.user_id,
--     up.full_name,
--     up.username,
--     ur.restriction_type,
--     ur.reason,
--     ur.expires_at,
--     ur.created_at
-- FROM user_restrictions ur
-- JOIN user_profiles up ON ur.user_id = up.user_id
-- WHERE ur.is_active = true
-- ORDER BY ur.created_at DESC;

-- View all early access features:
-- SELECT * FROM early_access_features WHERE is_active = true;
