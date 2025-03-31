# -*- coding: utf-8 -*-


if __name__ == "__main__":
    import os
    from datetime import datetime
    from tabs._5_prescriptions_page import PrescriptionsPage  # adjust this if needed

    def quick_test():
        client_name = "Brian James"
        start_date = "03/28/2025"
        steps = {
            "Col1": [
                {"product": "Cleanse", "directions": "Use the Ultra Foaming Gel Cleanser with lukewarm water, massaging gently for at least 60 seconds to ensure all debris and buildup are thoroughly removed before patting dry with a clean towel."},
                {"product": "Tone", "directions": "Apply the Balancing Toner generously using a cotton round, making sure to press gently into the skin rather than rubbing, especially around sensitive areas like the cheeks and forehead."},
                {"product": "Serum", "directions": "Dispense 1 to 2 pumps of the Growth Factor serum and distribute evenly over the face and neck. Allow the product to absorb fully before layering additional products."},
                {"product": "Moisturizer", "directions": "Use the Advanced Hydra Serum and press into the skin using the palms of your hands. Focus on drier areas and don’t forget to apply to the jawline and neck."},
                {"product": "SPF", "directions": "Apply a generous amount of Tinted Defense sunscreen 15 minutes before sun exposure. Be sure to reapply throughout the day, especially if perspiring or after towel drying."},
                {"product": "Eye Cream", "directions": "Gently tap a pea-sized amount of the Intensive Eye Cream around the entire orbital bone using your ring finger to avoid tugging on the delicate eye area."},
                {"product": "Lip Treatment", "directions": "Apply the Lip Balm after all other steps. Reapply as needed throughout the day to maintain hydration and protection from environmental stressors."},
                {"product": "Neck Cream", "directions": "Apply the Neck & Decollete Serum in upward sweeping motions. Use morning and night for best results and avoid applying to freshly exfoliated skin."}
            ],
            "Col2": [
                {"product": "Cleanse", "directions": "Use the AQ1 Deep Pore Cleanser in the evening, especially if you have worn makeup or SPF. Perform a double cleanse by starting with Skin Prep, then follow with the cleanser to ensure full removal."},
                {"product": "Mask", "directions": "Apply the Quench Mask 2–3 times a week. Leave on for 10–15 minutes while avoiding eye and lip areas. Rinse thoroughly with cool water and pat dry. Follow with hydrating products immediately."},
                {"product": "Serum", "directions": "Use the Nourishing C&E Serum in the evening, focusing on areas showing pigmentation or sun damage. Allow 5 minutes to absorb before proceeding to next step."},
                {"product": "Night Cream", "directions": "Massage the Night Cream with Collagen & Elastin into the skin using upward strokes. This step is essential to support skin elasticity and deep hydration overnight."},
                {"product": "Spot Treatment", "directions": "Apply BP-9 Cream only on active breakouts or red inflamed areas. Do not overuse as it may cause dryness or irritation. Spot use only, not full-face."},
                {"product": "Hydrating Mist", "directions": "Spritz Hydra-Cool Gel Mist after cleansing and before applying serum. This helps to prep the skin and enhance absorption of active ingredients."},
                {"product": "Retinol Cream", "directions": "Apply a thin layer of Rejuvenating Cream to the entire face, avoiding eyes and lips. Use only at night and follow with moisturizer to reduce dryness."},
                {"product": "Overnight Mask", "directions": "On nights when retinol is not used, apply the Soothing Zinc Gel Mask as the final step. Leave on overnight and rinse off in the morning."}
            ],
            "Col1_Header": "Morning",
            "Col2_Header": "Night"
        }

        # steps = {
        #     "Col1": [
        #         "Cleanse\nUse the Ultra Foaming Gel Cleanser with lukewarm water for 60 seconds.",
        #         "Tone\nApply Balancing Toner gently with a cotton round.",
        #         "Serum\nApply 1–2 pumps of Growth Factor serum to face and neck.",
        #         "Moisturizer\nPress Hydra Serum into skin, focusing on dry areas.",
        #         "SPF\nApply Tinted Defense sunscreen 15 minutes before sun.",
        #         "Eye Cream\nUse a pea-sized amount around eyes with ring finger.",
        #         "Lip Treatment\nApply Lip Balm. Reapply as needed for hydration.",
        #         "Neck Cream\nUse Neck & Decollete Serum with upward motions."
        #     ],
        #     "Col2": [
        #         "Cleanse\nUse AQ1 Cleanser to remove makeup and SPF.",
        #         "Mask\nApply Quench Mask 2–3 times a week for 15 minutes.",
        #         "Serum\nApply C&E Serum to areas with pigmentation.",
        #         "Night Cream\nMassage Night Cream with upward strokes.",
        #         "Spot Treatment\nApply BP-9 Cream to breakouts only.",
        #         "Hydrating Mist\nSpritz Mist after cleansing to prep skin.",
        #         "Retinol Cream\nApply Rejuvenating Cream at night only.",
        #         "Overnight Mask\nUse Zinc Gel Mask overnight if no retinol."
        #     ]
        # }

        # Initialize a dummy instance of the class
        dummy_page = PrescriptionsPage(parent=None, conn=None, main_app=None)

        # Call the PDF generator directly
        output_path = dummy_page.generate_2_column_pdf(client_name, start_date, steps)

        import webbrowser
        webbrowser.open(output_path)


        print(f"\n✅ PDF successfully created at:\n{output_path}\n")

    quick_test()
