==================================
Installing on Fedora (and friends)
==================================

The Fedora Linux distribution includes packages that ease the installation of Review Board.  However manual steps are necessary to create a site.  Note these steps target Fedora 21 and CentOS 7.

1. [CentOS] Enable EPEL_ repo.

.. _EPEL: https://fedoraproject.org/wiki/EPEL

ReviewBoard is included in the Fedora, it's available for CentOS via the community provided EPEL_ repo.
::

 sudo yum install epel-release

2. Install packages

.. _MariaDB: https://mariadb.org/

Review Board supports MySQL, MariaDB, PostgreSQL and sqlite.  This example uses MariaDB_.
::

 sudo yum install ReviewBoard mariadb-server memcached

3. Start database server and secure it.

Note the database root password you assign, it'll be used in the next step.
::

 sudo systemctl enable mariadb
 sudo systemctl start mariadb
 sudo mysql_secure_installation

4. Create the database

Choose your own database username and password.  They'll be used again in the next step.
::

 mysql -u root -p
 > create user review_user@localhost identified by 'review_password';
 > create database reviewboard;
 > GRANT ALL ON reviewboard.* TO review_user;

5. Create a Review Board site

::

 sudo rb-site install /var/www/reviewboard

6. Incorporate Review Board configuration into web server setup.

Review Board supports Apache httpd and lighttpd.  This example uses httpd.
::

 sudo ln -s /var/www/reviewboard/conf/apache-wsgi.conf /etc/httpd/conf.d/

7. Adjust file permissions

The web server needs write access to some directories.
::

 sudo chown -R apache /var/www/reviewboard/data
 sudo chown -R apache /var/www/reviewboard/htdocs/media/ext
 sudo chown -R apache /var/www/reviewboard/htdocs/static/ext
 sudo chown -R apache /var/www/reviewboard/htdocs/media/uploaded

8. Adjust SELinux permissions

::

 sudo setsebool -P httpd_can_network_memcache 1
 sudo chcon --type=httpd_sys_rw_content_t /var/www/reviewboard/data
 sudo chcon --type=httpd_sys_rw_content_t /var/www/reviewboard/htdocs/media/ext
 sudo chcon --type=httpd_sys_rw_content_t /var/www/reviewboard/htdocs/static/ext
 sudo chcon --type=httpd_sys_rw_content_t /var/www/reviewboard/htdocs/media/uploaded

9. Permit TCP connections to port 80

This opens connections on all interfaces.  You may want a more restrictive setup.

::

 sudo firewall-cmd --add-port=80/tcp
 sudo firewall-cmd --permanent --add-port=80/tcp

10. Start the web server

Performance is improved by using memcached.

::

 sudo systemctl enable memcached
 sudo systemctl start memcached
 sudo systemctl enable httpd
 sudo systemctl start httpd

