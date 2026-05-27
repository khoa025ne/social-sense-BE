-- SQL Script to Seed Data for SocialSense
-- 5 Users with different roles and quotas
-- Also inserts dummy Trends and Tags for testing Content Generation

-- 1. Insert Roles
INSERT INTO `Roles` (`Id`, `Name`, `Description`, `CreatedAt`) VALUES
('8bde0d12-1f34-4b5f-9dc1-b60ab60c1d1a', 'Admin', 'System Administrator with unlimited access and quota', UTC_TIMESTAMP()),
('2cde0d12-1f34-4b5f-9dc1-b60ab60c1d1b', 'Manager', 'Content Manager overseeing trends and creators', UTC_TIMESTAMP()),
('3cde0d12-1f34-4b5f-9dc1-b60ab60c1d1c', 'Creator', 'Premium content creator with high daily quota limits', UTC_TIMESTAMP()),
('4cde0d12-1f34-4b5f-9dc1-b60ab60c1d1d', 'Regular', 'Standard registered user with default quota limits', UTC_TIMESTAMP()),
('5cde0d12-1f34-4b5f-9dc1-b60ab60c1d1e', 'Guest', 'Limited guest user with low daily quota limits', UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE `Description` = VALUES(`Description`);

-- 2. Insert Users (Password: password123)
-- Password hash here is just a placeholder standard hash, change as needed for application auth type.
INSERT INTO `Users` (`Id`, `Email`, `DisplayName`, `PasswordHash`, `HasContext`, `IsActive`, `DailyQuotaLimit`, `RemainingQuota`, `LastQuotaReset`, `CreatedAt`, `UpdatedAt`) VALUES
('admin-user-id', 'admin@socialsense.com', 'System Admin', '$2a$12$R9h/lIPzMRgG7Vz6HkF7ee0qJ1r8.w8d0xG7Z83wYfE23k51XQx0e', 1, 1, 9999, 9999, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('manager-user-id', 'manager@socialsense.com', 'Content Manager', '$2a$12$R9h/lIPzMRgG7Vz6HkF7ee0qJ1r8.w8d0xG7Z83wYfE23k51XQx0e', 1, 1, 100, 100, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('creator-user-id', 'creator@socialsense.com', 'Premium Creator', '$2a$12$R9h/lIPzMRgG7Vz6HkF7ee0qJ1r8.w8d0xG7Z83wYfE23k51XQx0e', 1, 1, 30, 30, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('regular-user-id', 'regular@socialsense.com', 'Standard User', '$2a$12$R9h/lIPzMRgG7Vz6HkF7ee0qJ1r8.w8d0xG7Z83wYfE23k51XQx0e', 1, 1, 10, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('guest-user-id', 'guest@socialsense.com', 'Guest User', '$2a$12$R9h/lIPzMRgG7Vz6HkF7ee0qJ1r8.w8d0xG7Z83wYfE23k51XQx0e', 1, 1, 1, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE `DisplayName` = VALUES(`DisplayName`), `DailyQuotaLimit` = VALUES(`DailyQuotaLimit`), `RemainingQuota` = VALUES(`RemainingQuota`);

-- 3. Assign Roles to Users
INSERT INTO `UserRoles` (`UserId`, `RoleId`) VALUES
('admin-user-id', '8bde0d12-1f34-4b5f-9dc1-b60ab60c1d1a'),
('manager-user-id', '2cde0d12-1f34-4b5f-9dc1-b60ab60c1d1b'),
('creator-user-id', '3cde0d12-1f34-4b5f-9dc1-b60ab60c1d1c'),
('regular-user-id', '4cde0d12-1f34-4b5f-9dc1-b60ab60c1d1d'),
('guest-user-id', '5cde0d12-1f34-4b5f-9dc1-b60ab60c1d1e')
ON DUPLICATE KEY UPDATE `RoleId` = VALUES(`RoleId`);

-- 4. Seed UserContexts for each User (required for Content Generation Persona context)
INSERT INTO `UserContexts` (`Id`, `UserId`, `Version`, `JobTitle`, `ToneOfVoice`, `Language`, `PlatformPreferencesJson`, `TargetAudienceJson`, `ContentFormatsJson`, `NegativeConstraintsJson`, `CreatedAt`) VALUES
('ctx-admin', 'admin-user-id', 1, 'Chief Technology Officer', 'Professional and Informative', 'en', '["LinkedIn", "Twitter"]', '["Tech Leaders", "Developers"]', '["Technical Articles", "Quick Tips"]', '["Unverified rumors", "Slang"]', UTC_TIMESTAMP()),
('ctx-manager', 'manager-user-id', 1, 'Social Media Manager', 'Casual and Friendly', 'vi', '["Facebook", "Instagram"]', '["Gen Z", "Young Adults"]', '["Short posts", "Storytelling"]', '["Too formal language"]', UTC_TIMESTAMP()),
('ctx-creator', 'creator-user-id', 1, 'Content Creator & Designer', 'Creative and Energetic', 'vi', '["TikTok", "YouTube"]', '["Designers", "Students"]', '["Tutorials", "Behind the scenes"]', '["Boring definitions"]', UTC_TIMESTAMP()),
('ctx-regular', 'regular-user-id', 1, 'Software Engineer', 'Technical and Analytical', 'vi', '["LinkedIn", "Medium"]', '["Engineers"]', '["Postmortems", "Code reviews"]', '["Non-technical topics"]', UTC_TIMESTAMP()),
('ctx-guest', 'guest-user-id', 1, 'Curious Reader', 'Inspirational', 'vi', '["Facebook"]', '["General Public"]', '["Daily quotes"]', '["Politics"]', UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE `JobTitle` = VALUES(`JobTitle`), `ToneOfVoice` = VALUES(`ToneOfVoice`), `Language` = VALUES(`Language`);

-- 5. Seed dummy Trends & Tags for testing Content Generation
INSERT INTO `Tags` (`Id`, `Name`, `Slug`) VALUES
('tag-tech-id-111111111111111111111', 'Công nghệ', 'cong-nghe'),
('tag-finance-id-22222222222222222', 'Tài chính', 'tai-chinh'),
('tag-education-id-333333333333333', 'Giáo dục', 'giao-duc')
ON DUPLICATE KEY UPDATE `Name` = VALUES(`Name`);

INSERT INTO `Trends` (`Id`, `Title`, `Summary`, `SourceUrl`, `HotLevel`, `Sentiment`, `CreatedAt`) VALUES
('trend-ai-future-id-1111111111111111', 'Trí tuệ nhân tạo tạo sinh (Generative AI) bùng nổ năm 2026', 'Generative AI tiếp tục thay đổi cấu trúc ngành công nghiệp phần mềm và marketing với khả năng tự động hóa 80% công việc soạn thảo nội dung và lập trình cơ bản.', 'https://example.com/trends/generative-ai-2026', 5, 'Positive', UTC_TIMESTAMP()),
('trend-crypto-id-2222222222222222222', 'Xu hướng tiền kỹ thuật số và quản lý tài sản số', 'Thị trường tài chính ghi nhận sự dịch chuyển lớn khi các ngân hàng trung ương thí điểm tiền kỹ thuật số pháp định (CBDC) rộng rãi hơn.', 'https://example.com/trends/digital-finance', 3, 'Neutral', UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE `Title` = VALUES(`Title`), `Summary` = VALUES(`Summary`);

INSERT INTO `TrendTags` (`TrendId`, `TagId`) VALUES
('trend-ai-future-id-1111111111111111', 'tag-tech-id-111111111111111111111'),
('trend-crypto-id-2222222222222222222', 'tag-finance-id-22222222222222222')
ON DUPLICATE KEY UPDATE `TagId` = VALUES(`TagId`);
