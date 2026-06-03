SELECT s.title, s.price, c.name AS category
FROM services s
JOIN service_categories c ON s.category_id = c.id
WHERE s.active = 1
ORDER BY s.price DESC
LIMIT 3;
