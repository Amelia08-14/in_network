ALTER TABLE `contact_messages`
    ADD COLUMN `replyText` TEXT NULL,
    ADD COLUMN `repliedAt` DATETIME(3) NULL;
