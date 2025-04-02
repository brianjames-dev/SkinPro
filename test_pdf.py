# -*- coding: utf-8 -*-
if __name__ == "__main__":
    import os
    import datetime
    import webbrowser
    from prescriptions.pdf_generators.pdf_2col import Pdf2ColGenerator
    from prescriptions.pdf_generators.pdf_3col import Pdf3ColGenerator
    from prescriptions.pdf_generators.pdf_4col import Pdf4ColGenerator

    client_name = "Brian James"
    start_date = "03/28/2025"

    # === Long Descriptions for 2-column ===
    steps_2col = {
        "Col1": [
            {"product": "Cleanse", "directions": "Use the Ultra Foaming Gel Cleanser with lukewarm water, massaging for at least 60 seconds before rinsing off completely."},
            {"product": "Tone", "directions": "Apply Balancing Toner generously using a cotton round, patting into the skin gently."},
            {"product": "Serum", "directions": "Dispense 1-2 pumps of Growth Factor serum and apply evenly across face and neck."},
            {"product": "Moisturizer", "directions": "Use the Advanced Hydra Serum and press into skin, especially on dry patches."},
            {"product": "SPF", "directions": "Apply Tinted Defense sunscreen 15 minutes before exposure and reapply regularly."},
            {"product": "Eye Cream", "directions": "Use a pea-sized amount of Intensive Eye Cream around the orbital bone."},
            {"product": "Lip Treatment", "directions": "Apply the Lip Balm after other steps, reapply as needed."},
            {"product": "Neck Cream", "directions": "Apply Neck & Decollete Serum using upward motions morning and night."}
        ],
        "Col2": [
            {"product": "Cleanse", "directions": "Double cleanse with Skin Prep followed by AQ1 Deep Pore Cleanser to remove buildup."},
            {"product": "Mask", "directions": "Apply Quench Mask 2–3 times a week, leave on for 10–15 mins, then rinse."},
            {"product": "Serum", "directions": "Apply Nourishing C&E Serum focusing on sun-damaged areas."},
            {"product": "Night Cream", "directions": "Massage Night Cream into skin to support overnight hydration."},
            {"product": "Spot Treatment", "directions": "Apply BP-9 only to breakout-prone or inflamed areas."},
            {"product": "Hydrating Mist", "directions": "Spritz after cleansing to enhance absorption of serums."},
            {"product": "Retinol Cream", "directions": "Apply a thin layer of Rejuvenating Cream at night."},
            {"product": "Overnight Mask", "directions": "Use Zinc Gel Mask as last step on non-retinol nights."}
        ],
        "Col1_Header": "Morning",
        "Col2_Header": "Night"
    }

    # === Medium Descriptions for 3-column ===
    steps_3col = {
        "Col1": [{"product": "Morning Cleanse", "directions": "Use  with lukewarm water, massaging for at least 60 seconds before rinsing."}] * 8,
        "Col2": [{"product": "Tone", "directions": "Apply Balancing Toner generously using a cotton round, patting into the skin gently."}] * 8,
        "Col3": [{"product": "Serum", "directions": "Dispense 1-2 pumps of Growth Factor serum and apply evenly across face and neck."}] * 8,
        "Col1_Header": "Morning",
        "Col2_Header": "Midday",
        "Col3_Header": "Night"
    }

    # === Short Descriptions for 4-column ===
    steps_4col = {
        "Col1": [{"product": "Morning Cleanse", "directions": "Use  with lukewarm water, massage for 60 seconds."}] * 8,
        "Col2": [{"product": "Tone", "directions": "Apply generously using a cotton round, pat into skin gently."}] * 8,
        "Col3": [{"product": "Serum", "directions": "1-2 pumps of Growth Factor serum and apply evenly"}] * 8,
        "Col4": [{"product": "Moisturizer", "directions": "Use the Advanced Hydra Serum and press into skin."}] * 8,
        "Col1_Header": "Monday",
        "Col2_Header": "Wednesday",
        "Col3_Header": "Friday",
        "Col4_Header": "Weekend"
    }

    # Generate and open all PDFs
    paths = [
        Pdf2ColGenerator().generate(client_name, start_date, steps_2col),
        Pdf3ColGenerator().generate(client_name, start_date, steps_3col),
        Pdf4ColGenerator().generate(client_name, start_date, steps_4col)
    ]

    for path in paths:
        webbrowser.open(path)
        print(f"✅ PDF created at: {path}")
