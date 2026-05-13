CREATE DATABASE IF NOT EXISTS my_workshop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE my_workshop;

CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  manager_ext_id VARCHAR(255) NOT NULL,
  agreement_number VARCHAR(100),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  target_date DATETIME,
  total_cost DECIMAL(10,2),
  current_stage VARCHAR(100) NOT NULL,
  INDEX idx_orders_client_id (client_id),
  CONSTRAINT fk_orders_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  article VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  base_cost DECIMAL(10,2) NOT NULL,
  stock_snapshot DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  stock_snapshot_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS specification_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  material_id INT NOT NULL,
  required_quantity DECIMAL(10,3) NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL,
  INDEX idx_spec_order_id (order_id),
  INDEX idx_spec_material_id (material_id),
  CONSTRAINT fk_spec_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_spec_material
    FOREIGN KEY (material_id) REFERENCES materials(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS status_histories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  stage_name VARCHAR(100) NOT NULL,
  transition_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  employee_ext_id VARCHAR(255) NOT NULL,
  INDEX idx_status_order_id (order_id),
  CONSTRAINT fk_status_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  operation_name VARCHAR(100) NOT NULL,
  progress_status VARCHAR(100) NOT NULL,
  master_ext_id VARCHAR(255) NULL,
  INDEX idx_tasks_order_id (order_id),
  CONSTRAINT fk_tasks_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  order_id INT NULL,
  tx_type VARCHAR(50) NOT NULL,
  quantity_change DECIMAL(10,3) NOT NULL,
  tx_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tx_material_id (material_id),
  INDEX idx_tx_order_id (order_id),
  CONSTRAINT fk_tx_material
    FOREIGN KEY (material_id) REFERENCES materials(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tx_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  secure_link VARCHAR(500) NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_order_id (order_id),
  CONSTRAINT fk_media_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
