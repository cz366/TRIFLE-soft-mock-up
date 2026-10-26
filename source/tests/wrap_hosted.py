# Wrap the hosted build in a minimal host page with a downloads stub, for headless tests.
# Usage: python3 wrap_hosted.py <hosted build> <output> <host head file>
import sys
src, out, head = sys.argv[1:4]
open(out, 'w').write(open(head).read() + open(src).read() + '\n</body></html>\n')
