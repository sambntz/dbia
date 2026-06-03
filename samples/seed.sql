INSERT INTO users
(first_name, last_name, email, bio, country)
VALUES
('John','Smith','john@example.com','Senior Full Stack Developer','USA'),
('Emma','Wilson','emma@example.com','UX/UI Designer','Canada'),
('Lucas','Brown','lucas@example.com','English Teacher','UK');

INSERT INTO customers
(first_name,last_name,email,phone)
VALUES
('Alice','Johnson','alice@example.com','111111'),
('Bob','Miller','bob@example.com','222222'),
('Sophia','Davis','sophia@example.com','333333');

INSERT INTO service_categories
(name,description)
VALUES
('Software Development','Custom software services'),
('Design','Graphic and UX design'),
('Education','Online teaching services');

INSERT INTO services
(user_id,category_id,title,description,duration_minutes,price)
VALUES
(1,1,'REST API Development','Spring Boot REST API',240,250.00),
(1,1,'Database Design','MySQL and PostgreSQL schema design',120,120.00),
(2,2,'Landing Page Design','Modern responsive landing page',180,180.00),
(2,2,'Logo Design','Professional logo package',90,90.00),
(3,3,'English Conversation Class','One-on-one online lesson',60,25.00);

INSERT INTO orders
(customer_id,status,total_amount)
VALUES
(1,'PAID',250.00),
(2,'COMPLETED',205.00),
(3,'PENDING',90.00);

INSERT INTO order_items
(order_id,service_id,quantity,unit_price)
VALUES
(1,1,1,250.00),
(2,3,1,180.00),
(2,5,1,25.00),
(3,4,1,90.00);

INSERT INTO payments
(order_id,payment_method,amount,paid_at)
VALUES
(1,'CREDIT_CARD',250.00,NOW()),
(2,'PAYPAL',205.00,NOW());

INSERT INTO reviews
(customer_id,service_id,rating,comment)
VALUES
(1,1,5,'Excellent work and communication'),
(2,3,4,'Very professional designer'),
(2,5,5,'Great teacher');