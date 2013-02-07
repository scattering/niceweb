import os
import base64
import uuid

def get_cookie():
    """
    Retrieve cookie from ~/.niceweb_cookie, or create a new cookie
    file if this one does not exist.
    """
    cookie_file = os.path.expanduser('~/.niceweb_cookie')
    if not os.path.exists(cookie_file):
        cookie = base64.b64encode(uuid.uuid4().bytes + uuid.uuid4().bytes)
        with open(cookie_file, 'wb') as fid:
            fid.write(cookie)
    else:
        with open(cookie_file, 'rb') as fid:
            cookie = fid.read()

    return cookie
