"""Domain models live here in later phases.

A domain model is the Python class that maps to a database table
(SQLAlchemy) or a core business object. Keeping them out of route files
stops HTTP details from leaking into the data model.
"""
