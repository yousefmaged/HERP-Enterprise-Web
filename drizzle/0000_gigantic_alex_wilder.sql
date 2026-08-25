CREATE TABLE `attendanceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`workDate` timestamp NOT NULL,
	`checkInAt` timestamp,
	`checkOutAt` timestamp,
	`status` enum('present','absent','late','remote') NOT NULL DEFAULT 'present',
	`notes` text,
	CONSTRAINT `attendanceRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`actorUserId` int,
	`moduleKey` enum('dashboard','hr','finance','inventory','crm','reports','settings') NOT NULL DEFAULT 'dashboard',
	`action` varchar(96) NOT NULL,
	`entityType` varchar(96) NOT NULL,
	`entityId` varchar(96),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`city` varchar(120),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chartAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`accountCode` varchar(32) NOT NULL,
	`accountName` varchar(180) NOT NULL,
	`accountType` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`parentAccountId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chartAccounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`companyName` varchar(180),
	`email` varchar(320),
	`phone` varchar(48),
	`status` enum('lead','active','inactive') NOT NULL DEFAULT 'lead',
	`ownerUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crmFollowUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`opportunityId` int,
	`clientId` int NOT NULL,
	`type` enum('call','meeting','email','note') NOT NULL DEFAULT 'note',
	`content` text NOT NULL,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crmFollowUps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`name` varchar(160) NOT NULL,
	`managerEmployeeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`departmentId` int,
	`userId` int,
	`employeeCode` varchar(40) NOT NULL,
	`fullName` varchar(180) NOT NULL,
	`jobTitle` varchar(160) NOT NULL,
	`email` varchar(320),
	`phone` varchar(48),
	`joinDate` timestamp,
	`employmentStatus` enum('active','on_leave','inactive') NOT NULL DEFAULT 'active',
	`baseSalary` decimal(14,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`clientId` int,
	`invoiceNumber` varchar(48) NOT NULL,
	`invoiceType` enum('sales','purchase') NOT NULL DEFAULT 'sales',
	`issueDate` timestamp NOT NULL,
	`dueDate` timestamp,
	`totalAmount` decimal(14,2) NOT NULL DEFAULT '0.00',
	`paidAmount` decimal(14,2) NOT NULL DEFAULT '0.00',
	`status` enum('draft','sent','overdue','paid','void') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journalEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`entryNumber` varchar(48) NOT NULL,
	`entryDate` timestamp NOT NULL,
	`description` text NOT NULL,
	`sourceModule` varchar(48),
	`status` enum('draft','posted','void') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journalLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`journalEntryId` int NOT NULL,
	`accountId` int NOT NULL,
	`debit` decimal(14,2) NOT NULL DEFAULT '0.00',
	`credit` decimal(14,2) NOT NULL DEFAULT '0.00',
	`memo` varchar(240),
	CONSTRAINT `journalLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaveRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`leaveType` enum('annual','sick','unpaid','other') NOT NULL DEFAULT 'annual',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`reason` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leaveRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int,
	`type` enum('task','invoice','inventory','leave','system') NOT NULL,
	`title` varchar(220) NOT NULL,
	`body` text,
	`moduleKey` enum('dashboard','hr','finance','inventory','crm','reports','settings') NOT NULL DEFAULT 'dashboard',
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizationMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('general_manager','unit_manager','employee') NOT NULL DEFAULT 'employee',
	`allowedModules` json NOT NULL,
	`branchScope` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizationMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`legalName` varchar(240),
	`taxNumber` varchar(80),
	`baseCurrency` varchar(3) NOT NULL DEFAULT 'SAR',
	`fiscalYearStartMonth` int NOT NULL DEFAULT 1,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payrollRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`periodLabel` varchar(48) NOT NULL,
	`totalGross` decimal(14,2) NOT NULL DEFAULT '0.00',
	`totalNet` decimal(14,2) NOT NULL DEFAULT '0.00',
	`status` enum('draft','review','approved','paid') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payrollRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` varchar(120),
	`unit` varchar(32) NOT NULL DEFAULT 'قطعة',
	`salePrice` decimal(14,2) NOT NULL DEFAULT '0.00',
	`quantityOnHand` decimal(14,3) NOT NULL DEFAULT '0.000',
	`reorderLevel` decimal(14,3) NOT NULL DEFAULT '0.000',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reportSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`frequency` enum('daily','weekly') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`schedule_cron_task_uid` varchar(65),
	`lastSentAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesOpportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`clientId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`estimatedValue` decimal(14,2) NOT NULL DEFAULT '0.00',
	`stage` enum('qualification','proposal','negotiation','won','lost') NOT NULL DEFAULT 'qualification',
	`expectedCloseDate` timestamp,
	`ownerUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesOpportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int,
	`movementType` enum('in','out','adjustment') NOT NULL,
	`quantity` decimal(14,3) NOT NULL,
	`reference` varchar(96),
	`notes` text,
	`movedAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`branchId` int,
	`code` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`moduleKey` enum('dashboard','hr','finance','inventory','crm','reports','settings') NOT NULL DEFAULT 'dashboard',
	`assignedToUserId` int,
	`dueAt` timestamp,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','completed','cancelled') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `attendance_org_date_idx` ON `attendanceRecords` (`organizationId`,`workDate`);--> statement-breakpoint
CREATE INDEX `audit_org_created_idx` ON `auditLogs` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `branches_org_idx` ON `branches` (`organizationId`);--> statement-breakpoint
CREATE INDEX `accounts_org_idx` ON `chartAccounts` (`organizationId`);--> statement-breakpoint
CREATE INDEX `clients_org_idx` ON `clients` (`organizationId`);--> statement-breakpoint
CREATE INDEX `followups_org_idx` ON `crmFollowUps` (`organizationId`);--> statement-breakpoint
CREATE INDEX `departments_org_idx` ON `departments` (`organizationId`);--> statement-breakpoint
CREATE INDEX `employees_org_idx` ON `employees` (`organizationId`);--> statement-breakpoint
CREATE INDEX `employees_department_idx` ON `employees` (`departmentId`);--> statement-breakpoint
CREATE INDEX `invoice_org_status_idx` ON `invoices` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `journal_org_date_idx` ON `journalEntries` (`organizationId`,`entryDate`);--> statement-breakpoint
CREATE INDEX `leave_org_status_idx` ON `leaveRequests` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `notifications_org_read_idx` ON `notifications` (`organizationId`,`isRead`);--> statement-breakpoint
CREATE INDEX `org_member_org_idx` ON `organizationMembers` (`organizationId`);--> statement-breakpoint
CREATE INDEX `org_member_user_idx` ON `organizationMembers` (`userId`);--> statement-breakpoint
CREATE INDEX `payroll_org_idx` ON `payrollRuns` (`organizationId`);--> statement-breakpoint
CREATE INDEX `products_org_idx` ON `products` (`organizationId`);--> statement-breakpoint
CREATE INDEX `report_schedule_task_uid_idx` ON `reportSchedules` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `opportunities_org_idx` ON `salesOpportunities` (`organizationId`);--> statement-breakpoint
CREATE INDEX `stock_movement_org_idx` ON `stockMovements` (`organizationId`);--> statement-breakpoint
CREATE INDEX `warehouse_org_idx` ON `warehouses` (`organizationId`);--> statement-breakpoint
CREATE INDEX `tasks_org_status_idx` ON `workTasks` (`organizationId`,`status`);