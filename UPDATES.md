## Update - Done section 

### James 
    - UPdated login and register
    - Configured logins and register

### Godfrey 

    - Configured POST and GET from server endpoints 
    - Added payments gateway
    - Configuring Payment API (MPESA, )



    install django-mpesa 
    
        `pip install django-mpesa`

    Added :
        newsletters app
        contact app 
        configured the front end
        managing admin addign features like promotional messages

## Send data to server 
Ensure connection
database is the "default"
        
        python manage.py add_rigs
            
        python send_data.py 

database name 
    
    flips

Password    
    
    1391
Ensure the server is running. 

    


Ensure that the gunicorn is synchronized with the server to load static files 


    server {
        listen 80;
        server_name your_domain_or_IP;

        location / {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    
        location /static/ {
            alias /home/freak/Documents/floodsys/staticfiles/;
            expires 30d;
        }
    
        location /media/ {
            alias /home/freak/Documents/floodsys/media/;
            expires 30d;
        }
    
        error_log /var/log/nginx/error.log;
        access_log /var/log/nginx/access.log;
    }


Ensure a symbolic Link 

    sudo ln -s /etc/nginx/sites-available/floodsys /etc/nginx/sites-enabled/
    sudo systemctl restart nginx


psycopg2 installation 

        $ sudo apt-get install libpq-dev


## Neccessary Downlaods 

    sudo apt install postgis


    sudo apt-get install binutils libproj-dev gdal-bin


## Changing database 

    sudo apt update
    sudo apt install postgresql postgresql-contrib

    
    sudo systemctl start postgresql


    sudo systemctl enable postgresql


    sudo -u postgres psql


    CREATE DATABASE flips;
    
    \c floodsys_db
    
    CREATE EXTENSION postgis;


## Update on using flipsintel 

    -- Create a user flipsintel 
    
    sudo adduser flipsintel


 --- Change ownership 
sudo -u postgres psql

ALTER DATABASE flips OWNER TO flipsintel;

### Transfer Ownership of All Tables, Sequences, and Views:

Run the following commands to transfer ownership of all tables, sequences, and other objects in the public schema to flipsintel:

    DO $$ 
    DECLARE
        obj RECORD;
    BEGIN
        -- Change owner of all tables
        FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
            EXECUTE format('ALTER TABLE public.%I OWNER TO flipsintel', obj.tablename);
        END LOOP;
    
        -- Change owner of all sequences
        FOR obj IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
            EXECUTE format('ALTER SEQUENCE public.%I OWNER TO flipsintel', obj.sequencename);
        END LOOP;
    
        -- Change owner of all views (if any)
        FOR obj IN SELECT table_name FROM information_schema.views WHERE table_schema = 'public' LOOP
            EXECUTE format('ALTER VIEW public.%I OWNER TO flipsintel', obj.table_name);
        END LOOP;
    END $$;


### Grant all rights 
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO flipsintel;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO flipsintel;


    sudo -u flipsintel psql -U flipsintel -d flips

    

    sudo -u postgres psql
    GRANT ALL PRIVILEGES ON DATABASE flips TO flipsintel;
    You
    3:14 PM
    CREATE USER flipsintel WITH PASSWORD '1391';
    
    \c flips  -- Connect to the database
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO flipsintel;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO flipsintel;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO flipsintel;


