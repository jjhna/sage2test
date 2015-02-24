#!/bin/sh

# clean up
# /bin/rm -f *.crt *.csr *.key *.org

cd /sage2

# phony password
password=foobar
#server=$HOSTNAME
#server=iridium.evl.optiputer.net
server=$1

echo "Start: CA"
openssl genrsa -des3 -out ca.key  -passout pass:$password 1024
openssl req -new -key ca.key -out ca.csr -passin pass:$password -subj "/CN=$server"
openssl x509 -req -days 365 -in ca.csr -out $server-ca.crt -signkey ca.key  -passin pass:$password
echo ""
echo ""

#FQDN - hostname (webserver)
echo "Start Server Certificate"
openssl genrsa -des3 -out $server-server.key -passout pass:$password 1024
openssl req -new -key $server-server.key -out server.csr -passin pass:$password -subj "/CN=$server"
echo ""
echo ""

echo "Copy Server Certificate"
cp $server-server.key server.key.org
openssl rsa -in server.key.org -out $server-server.key -passin pass:$password
echo ""
echo ""

echo "Sign Server Certificate"
openssl x509 -req -days 365 -in server.csr -signkey $server-server.key -out $server-server.crt
echo ""
echo ""

echo "Trust Server Certificate - Add to DB"
# list the DB
certutil -d sql:/sage2/.pki/nssdb -L
# delete the previous server key
certutil -d sql:/sage2/.pki/nssdb -D -n $server
# add the new key
certutil -d sql:/sage2/.pki/nssdb -A -t "P,," -n $server -i $server-server.crt
# print the DB again
certutil -d sql:/sage2/.pki/nssdb -L
echo ""
echo "Finished"

/bin/rm -f server.key.org server.csr ca.csr ca.key


