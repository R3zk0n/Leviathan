FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY dev.conf /etc/nginx/conf.d/dev.conf
COPY ssl/directions.txt /etc/nginx/conf.d/ssl/directions.txt

RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/conf.d/ssl \
    && openssl req -new -newkey rsa:2048 -x509 -sha256 -days 365 -nodes \
        -out /etc/nginx/conf.d/ssl/nginx.crt \
        -keyout /etc/nginx/conf.d/ssl/nginx.key \
        -subj "/CN=localhost"
