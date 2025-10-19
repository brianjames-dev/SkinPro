# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = ['customtkinter', 'pdf2image', 'tkinter', 'reportlab', 'PIL.Image', 'PIL.ImageTk', 'PIL.ImageDraw', 'PIL.ImageOps', 'PIL.ImageFile', 'PIL.ExifTags', 'pdf2image.pdf2image', 'reportlab.pdfgen.canvas', 'reportlab.lib.pagesizes']
hiddenimports += collect_submodules('flask')
hiddenimports += collect_submodules('werkzeug')


a = Analysis(
    ['C:\\Users\\Amelia\\Documents\\SkinPro\\main.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\Amelia\\Documents\\SkinPro\\class_elements', 'class_elements/'), ('C:\\Users\\Amelia\\Documents\\SkinPro\\icons', 'icons/'), ('C:\\Users\\Amelia\\Documents\\SkinPro\\tabs', 'tabs/'), ('C:\\Users\\Amelia\\Documents\\SkinPro\\upload_server', 'upload_server/'), ('C:\\Users\\Amelia\\Documents\\SkinPro\\utils', 'utils/'), ('C:\\Users\\Amelia\\Documents\\SkinPro\\upload_server\\templates', 'upload_server/templates/')],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='SkinPro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version='C:\\Users\\Amelia\\Documents\\SkinPro\\version.txt',
    icon=['C:\\Users\\Amelia\\Documents\\SkinPro\\icons\\butterfly_icon.ico'],
)
