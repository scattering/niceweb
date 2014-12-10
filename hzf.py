import os, sys
import zipfile, tempfile, shutil
import json
from collections import OrderedDict
import numpy
import iso8601

DEFAULT_ENDIANNESS = '<' if (sys.byteorder == 'little') else '>'
__version__ = "4.2.1"


class WithAttrs(object):
    """ File, Group, etc. inherit from here to get access to the attrs 
    property, which is backed by .attrs.json in the filesystem """
    _ATTRS_FNAME = ".attrs.json"
    @property
    def attrs(self):
        """ file-backed attributes dict """
        return json.loads(open(os.path.join(self.fn, self.path, self._ATTRS_FNAME)).read())

    @attrs.setter
    def attrs(self, value):
        open(os.path.join(self.fn, self.path, self._ATTRS_FNAME), 'w').write(json.dumps(value))

    @attrs.deleter
    def attrs(self):
        """ you can't do this """
        raise NotImplementedError

class WithFields(object):
    """ File, Group, etc. inherit from here to get optional fields property, 
    which is backed by fields.json in the filesystem when fields are present """
    _FIELDS_FNAME = "fields.json"
    @property
    def fields(self):
        """ file-backed attributes dict """
        fpath = os.path.join(self.fn, self.path, self._FIELDS_FNAME)
        fields_out = {}
        if os.path.exists(fpath):
            fields_out = json.loads(open(fpath, 'r').read())
        return fields_out

    @fields.setter
    def fields(self, value):
        open(os.path.join(self.fn, self.path, self._FIELDS_FNAME), 'w').write(json.dumps(value))

    @fields.deleter
    def fields(self):
        """ you can't do this """
        raise NotImplementedError
        

class File(WithAttrs,WithFields):
    """ mimics the hdf5 File object """
    def __init__(self, filename, mode, timestamp=None, creator=None, compression=zipfile.ZIP_DEFLATED, rootpath=None, attrs={}, **kw):
        fn = tempfile.mkdtemp()
        # os.close(fd) # to be opened by name
        self.fn = fn
        self.filename = filename
        self.mode = mode
        self.compression = compression
        if rootpath is None:
            rootpath = filename.split('.')[0]
        self.path = rootpath
        preexisting = os.path.exists(os.path.join(self.fn, self.path))
        
        if (mode == "a" and not preexisting) or mode == "w":
            os.mkdir(os.path.join(self.fn, self.path))
            if timestamp is None:
                timestr = iso8601.now()
            else:
                # If given a time string, check that it is valid
                try:
                    timestamp = iso8601.parse_date(timestamp)
                except TypeError:
                    pass
                timestr = iso8601.format_date(timestamp)
            attrs['NX_class'] = 'NXroot'
            attrs['file_name'] = filename
            attrs['file_time'] = timestr
            attrs['NeXus_version'] = __version__
            if creator is not None:
                attrs['creator'] = creator
        self.attrs = attrs
            
    def __del__(self):
        self.writezip()
    
    def __getitem__(self, path):
        """ get an item based only on its path.
        Can assume that next-to-last segment is a group (dataset is lowest level)
        """
        basename = os.path.dirname(path)
        full_path = os.path.join(self.fn, self.path, path)
        if os.path.isdir(full_path):
            return Group(self, full_path)
        else:
            field_name = os.path.basename(full_path)
            full_path = os.path.dirname(full_path)
            if os.path.isdir(full_path):
                g = Group(self, full_path)
                return g.fields[field_name]
        
    @property
    def groups(self):
        groupnames = [x for x in os.listdir(os.path.join(self.fn, self.path)) if os.path.isdir(os.path.join(self.fn, self.path, x))]
        return dict([(gn, Group(self, gn)) for gn in groupnames])
        #return [x for x in os.listdir(os.path.join(self.fn, self.path)) if os.path.isdir(os.path.join(self.fn, self.path, x))]
    
    def add_field(self, path, **kw):
        Field(self, path, **kw)
        
    def add_group(self, path, nxclass, attrs={}):
        Group(self, nxclass, attrs)
    
    def writezip(self):
        #shutil.make_archive(self.filename, 'zip', root_dir=self.fn)
        make_zipfile(self.filename, os.path.join(self.fn, self.path), self.compression)
    
class Group(WithAttrs,WithFields):
    def __init__(self, node, path, nxclass=None, attrs={}):
        self.path = os.path.join(node.path, path)
        self.node = node
        self.fn = node.fn
        preexisting = os.path.exists(os.path.join(self.fn, self.path))
        
        if not preexisting:
            os.mkdir(os.path.join(self.fn, self.path))
            attrs['NX_class'] = nxclass.encode('UTF-8')
            self.attrs = attrs
    
    def __repr__(self):
        return "<HDF5 ZIP group \"" + self.path + "\">"
    
    @property
    def groups(self):
        groupnames = [x for x in os.listdir(os.path.join(self.fn, self.path)) if os.path.isdir(os.path.join(self.fn, self.path, x))]
        return dict([(gn, Group(self, gn)) for gn in groupnames])
        #return [x for x in os.listdir(os.path.join(self.fn, self.path)) if os.path.isdir(os.path.join(self.fn, self.path, x))]
        
    def add_field(self, path, **kw):
        Field(self, path, **kw)

class Field(object):
    _formats = {
        'S': '%s',
        'f': '%.8g',
        'i': '%d',
        'u': '%d' }
        
    def __init__(self, node, path, **kw):
        """
        Create a data object.
        
        Returns the data set created, or None if the data is empty.

        :Parameters:

        *node* : File object
            Handle to a File-like object.  This could be a file or a group.

        *path* : string
            Path to the data.  This could be a full path from the root
            of the file, or it can be relative to a group.  Path components
            are separated by '/'.

        *data* : array or string
            If the data is known in advance, then the value can be given on
            creation. Otherwise, use *shape* to give the initial storage
            size and *maxshape* to give the maximum size.

        *units* : string
            Units to display with data.  Required for numeric data.

        *label* : string
            Axis label if data is numeric.  Default for field dataset_name
            is "Dataset name (units)".

        *attrs* : dict
            Additional attributes to be added to the dataset.


        :Storage options:

        *dtype* : numpy.dtype
            Specify the storage type for the data.  The set of datatypes is
            limited only by the HDF-5 format, and its h5py interface.  Usually
            it will be 'int32' or 'float32', though others are possible.
            Data will default to *data.dtype* if *data* is specified, otherwise
            it will default to 'float32'.

        *shape* : [int, ...]
            Specify the initial shape of the storage and fill it with zeros.
            Defaults to [1, ...], or to the shape of the data if *data* is
            specified.

        *maxshape* : [int, ...]
            Maximum size for each dimension in the dataset.  If any dimension
            is None, then the dataset is resizable in that dimension.
            For a 2-D detector of size (Nx,Ny) with Nt time of flight channels
            use *maxshape=[Nx,Ny,Nt]*.  If the data is to be a series of
            measurements, then add an additional empty dimension at the front,
            giving *maxshape=[None,Nx,Ny,Nt]*.  If *maxshape* is not provided,
            then use *shape*.

        *chunks* : [int, ...]
            Storage block size on disk, which is also the basic compression
            size.  By default *chunks* is set from maxshape, with the
            first unspecified dimension set such that the chunk size is
            greater than nexus.CHUNK_SIZE. :func:`make_chunks` is used
            to determine the default value.

        *compression* : 'none|gzip|szip|lzf' or int
            Dataset compression style.  If not specified, then compression
            defaults to 'szip' for large datasets, otherwise it defaults to
            'none'. Datasets are considered large if each frame in maxshape
            is bigger than CHUNK_SIZE.  Eventmode data, with its small frame
            size but large number of frames, will need to set compression
            explicitly.  If compression is an integer, then use gzip compression
            with that compression level.

        *compression_opts* : ('ec|nn', int)
            szip compression options.

        *shuffle* : boolean
            Reorder the bytes before applying 'gzip' or 'hzf' compression.

        *fletcher32* : boolean
            Enable error detection of the dataset.

        :Returns:

        *dataset* : file-backed data object
            Reference to the created dataset.
        """
    
        data = kw.pop('data', None)
        dtype = kw.pop('dtype', None)
        shape = kw.pop('shape', None)
        units = kw.pop('units', None)
        label = kw.pop('label', None)
        inline = kw.pop('inline', False)
        binary = kw.pop('binary', False)
        attrs = kw.pop('attrs', {})
        
        
        self.path = path
        self.node = node
        self.fn = node.fn
        self.inline = inline
        self.binary = binary
       
        #os.mkdir(os.path.join(node.fn, self.path))
        attrs['dtype'] = dtype
        attrs['units'] = units
        attrs['label'] = label
        attrs['shape'] = shape
        attrs['byteorder'] = sys.byteorder
        if data is not None:
            self.set_data(data, attrs)
    
    @property
    def value(self):
        field = self.node.fields[self.path]
        if self.inline:
            return field['value']
        else:
            target = field['target']
            if self.binary:
                datastring = open(target, 'rb').read()
                d = numpy.fromstring(datastring, dtype=field['format'])
            else:
                datastring = open(target, 'r').read()
                d = numpy.loadtxt(target, fmt=field['format'])
            if 'shape' in field:
                d.reshape(field['shape'])
            return d
                
                
                
    
    def set_data(self, data, attrs=None):
        if attrs is None:
            attrs = self.node.fields[self.path]
        if hasattr(data, 'shape'): attrs['shape'] = data.shape
        if hasattr(data, 'dtype'): 
            formatstr = '<' if attrs['byteorder'] == 'little' else '>'
            formatstr += data.dtype.char
            formatstr += "%d" % (data.dtype.itemsize * 4,)
            attrs['format'] = formatstr
        if self.inline:            
            if hasattr(data, 'tolist'): data = data.tolist()
            attrs['value'] = data
        else:
            if self.binary:
                full_path = os.path.join(self.node.path, self.path + '.bin')
                open(os.path.join(self.node.fn, full_path), 'w').write(data.tostring())
            else:
                full_path = os.path.join(self.node.path, self.path + '.dat')
                numpy.savetxt(os.path.join(self.node.fn, full_path), data, delimiter='\t', fmt=self._formats[data.dtype.kind])
            attrs['target'] = full_path
            attrs['dtype'] = data.dtype.name
            attrs['shape'] = data.shape
        parent_fields = self.node.fields
        parent_fields[self.path] = attrs
        self.node.fields = parent_fields
        print self.node.fields

def make_zipfile(output_filename, source_dir, compression=zipfile.ZIP_DEFLATED):
    relroot = os.path.abspath(os.path.join(source_dir, os.pardir))
    with zipfile.ZipFile(output_filename, "w", compression) as zipped:
        for root, dirs, files in os.walk(source_dir):
            # add directory (needed for empty dirs)
            zipped.write(root, os.path.relpath(root, relroot))
            for file in files:
                filename = os.path.join(root, file)
                if os.path.isfile(filename): # regular files only
                    arcname = os.path.join(os.path.relpath(root, relroot), file)
                    zipped.write(filename, arcname)
    

