class PrescriptionProduct:
    def __init__(self, name, size, price, brand):
        self.name = name
        self.size = size
        self.price = price
        self.brand = brand

# List of all Corium and Laskin products
PRODUCT_CATALOG = [
    # --- CORIUM RETAIL PRODUCTS ---
    PrescriptionProduct("Ultra Foaming Gel Cleanser", "5.8oz", 50.00, "Corium"),
    PrescriptionProduct("Ultra Foaming Cream Cleanser", "2.4oz", 60.00, "Corium"),
    PrescriptionProduct("Balancing Toner (travel size)", ".75oz", 7.00, "Corium"),
    PrescriptionProduct("Balancing Toner", "7.5oz", 40.00, "Corium"),
    PrescriptionProduct("Depigmentation Cream", "1oz", 80.00, "Corium"),
    PrescriptionProduct("Exfoliant Plus Peptides", "1oz", 85.00, "Corium"),
    PrescriptionProduct("Growth Factor", "1oz", 110.00, "Corium"),
    PrescriptionProduct("Advanced Hydra Serum", "1oz", 70.00, "Corium"),
    PrescriptionProduct("Hydra Serum w/Glycolic", "1oz", 70.00, "Corium"),
    PrescriptionProduct("Hydrating Eye & Lip Serum", ".5oz", 90.00, "Corium"),
    PrescriptionProduct("Intensive Eye Cream", ".5oz", 95.00, "Corium"),
    PrescriptionProduct("Lip Balm", "7ml", 28.00, "Corium"),
    PrescriptionProduct("Neck & Decollete Serum", "1.5oz", 135.00, "Corium"),
    PrescriptionProduct("Night Cream with Collagen & Elastin", "2oz", 90.00, "Corium"),
    PrescriptionProduct("Nourishing C&E Serum", "1oz", 115.00, "Corium"),
    PrescriptionProduct("Sensitive Repair Cream", "1oz", 50.00, "Corium"),
    PrescriptionProduct("Skin Prep", "1oz", 50.00, "Corium"),
    PrescriptionProduct("3XS", "1oz", 60.00, "Corium"),
    PrescriptionProduct("A & R 5", "1oz", 75.00, "Corium"),
    PrescriptionProduct("A & R Ten", "1oz", 75.00, "Corium"),
    PrescriptionProduct("BP-9 Cream", "1oz", 90.00, "Corium"),
    PrescriptionProduct("Acne & Rosacea Calming Cream", "2oz", 90.00, "Corium"),
    PrescriptionProduct("Skin Recovery Gel", "4oz", 75.00, "Corium"),
    PrescriptionProduct("Ultra Repair Cream", "2oz", 125.00, "Corium"),
    PrescriptionProduct("Vitamin A Micropeeling Cream", "1oz", 100.00, "Corium"),
    PrescriptionProduct("Pore Tightening Mask", "4oz", 95.00, "Corium"),
    PrescriptionProduct("Purifying Mask", "4oz", 95.00, "Corium"),
    PrescriptionProduct("Quench Mask", "4oz", 95.00, "Corium"),
    PrescriptionProduct("Dermal Defense", "1oz", 45.00, "Corium"),
    PrescriptionProduct("Dermal Defense Plus", "2.4oz", 80.00, "Corium"),
    PrescriptionProduct("Tinted Defense", "1.5oz", 95.00, "Corium"),
    PrescriptionProduct("Body Cream", "8oz", 54.00, "Corium"),
    PrescriptionProduct("Body Cream Cleanser", "8oz", 54.00, "Corium"),
    PrescriptionProduct("Body Exfoliating Serum", "8oz", 64.00, "Corium"),
    PrescriptionProduct("Hands & Feet Renewal Cream", "5oz", 49.50, "Corium"),
    PrescriptionProduct("Enhancer", "2oz", 135.00, "Corium"),

    # --- LASKIN RETAIL PRODUCTS ---
    PrescriptionProduct("Antiseptic Cleanser", "8oz", 60.00, "Laskin"),
    PrescriptionProduct("AQ1 Cleanser (Deep Pore Cleanser)", "4oz", 60.00, "Laskin"),
    PrescriptionProduct("4N1", "1.5oz", 250.00, "Laskin"),
    PrescriptionProduct("C B P Cream", "1oz", 90.00, "Laskin"),
    PrescriptionProduct("Coleman Cream", "2oz", 95.00, "Laskin"),
    PrescriptionProduct("Correcting Cream Medium", "1oz", 85.00, "Laskin"),
    PrescriptionProduct("Growth Factor Serum", "2oz", 220.00, "Laskin"),
    PrescriptionProduct("Hydra-Cool Gel", "2oz", 120.00, "Laskin"),
    PrescriptionProduct("Post Soothe", "1oz", 66.00, "Laskin"),
    PrescriptionProduct("Spot Corrector", "1oz", 87.00, "Laskin"),
    PrescriptionProduct("Vitamin C Serum 20%  (No vitamin E)", "1oz", 115.00, "Laskin"),
    PrescriptionProduct("Z Cream", "1.5oz", 140.00, "Laskin"),
    PrescriptionProduct("Rejuvenating Cream  (1% vitamin A)", "1oz", 100.00, "Laskin"),
    PrescriptionProduct("Soothing Zinc Gel Mask", "10oz", 160.00, "Laskin"),
]
