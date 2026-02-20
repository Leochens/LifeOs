import struct
import zlib

def make_png(width, height, color):
    # minimal PNG
    # signature
    png = b'\x89PNG\r\n\x1a\n'
    # IHDR
    ihdr = struct.pack('!I', width) + struct.pack('!I', height) + b'\x08\x02\x00\x00\x00'
    png += struct.pack('!I', len(ihdr)) + b'IHDR' + ihdr + struct.pack('!I', zlib.crc32(b'IHDR' + ihdr))
    # IDAT
    raw_data = b''
    # Create one row of data and repeat it
    row_data = b'\x00' + (struct.pack('!BBB', *color) * width)
    # This might be slow for 1024x1024 in pure python if we concat huge string.
    # Instead, let's just make a small 512x512 to be safe, or optimize.
    # Actually, let's just do 512x512.
    final_data = row_data * height
    compressed = zlib.compress(final_data)
    png += struct.pack('!I', len(compressed)) + b'IDAT' + compressed + struct.pack('!I', zlib.crc32(b'IDAT' + compressed))
    # IEND
    png += struct.pack('!I', 0) + b'IEND' + struct.pack('!I', zlib.crc32(b'IEND'))
    return png

with open('app-icon.png', 'wb') as f:
    f.write(make_png(512, 512, (0, 150, 255)))
