import functools
import http.server

Handler = functools.partial(
    http.server.SimpleHTTPRequestHandler,
    directory="/Users/nalunui/Desktop/Claude/nalu-command-center",
)
httpd = http.server.HTTPServer(("localhost", 8000), Handler)
httpd.serve_forever()
