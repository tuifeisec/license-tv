package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server      ServerConfig      `mapstructure:"server"`
	Database    DatabaseConfig    `mapstructure:"database"`
	Redis       RedisConfig       `mapstructure:"redis"`
	Security    SecurityConfig    `mapstructure:"security"`
	JWT         JWTConfig         `mapstructure:"jwt"`
	TradingView TradingViewConfig `mapstructure:"tradingview"`
	Scheduler   SchedulerConfig   `mapstructure:"scheduler"`
	Admin       AdminConfig       `mapstructure:"admin"`
}

type ServerConfig struct {
	Port           int      `mapstructure:"port"`
	Mode           string   `mapstructure:"mode"`
	AllowedOrigins []string `mapstructure:"allowed_origins"`
	LogLevel       string   `mapstructure:"log_level"`
}

type DatabaseConfig struct {
	Host            string `mapstructure:"host"`
	Port            int    `mapstructure:"port"`
	User            string `mapstructure:"user"`
	Password        string `mapstructure:"password"`
	DBName          string `mapstructure:"dbname"`
	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
	MaxOpenConns    int    `mapstructure:"max_open_conns"`
	ConnMaxLifetime string `mapstructure:"conn_max_lifetime"`
	ConnMaxIdleTime string `mapstructure:"conn_max_idle_time"`
}

func (c DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=UTC",
		c.User,
		c.Password,
		c.Host,
		c.Port,
		c.DBName,
	)
}

func (c DatabaseConfig) MaxLifetime() time.Duration {
	d, err := time.ParseDuration(c.ConnMaxLifetime)
	if err != nil || d <= 0 {
		return time.Hour
	}
	return d
}

func (c DatabaseConfig) MaxIdleTime() time.Duration {
	d, err := time.ParseDuration(c.ConnMaxIdleTime)
	if err != nil || d <= 0 {
		return 15 * time.Minute
	}
	return d
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type SecurityConfig struct {
	DataEncryptionKey string `mapstructure:"data_encryption_key"`
}

type JWTConfig struct {
	Secret           string `mapstructure:"secret"`
	AdminExpireHours int    `mapstructure:"admin_expire_hours"`
	AgentExpireHours int    `mapstructure:"agent_expire_hours"`
	RefreshHours     int    `mapstructure:"refresh_hours"`
	CookieDomain     string `mapstructure:"cookie_domain"`
	CookieSecure     bool   `mapstructure:"cookie_secure"`
	CookieSameSite   string `mapstructure:"cookie_same_site"`
}

type TradingViewConfig struct {
	BaseURL        string `mapstructure:"base_url"`
	PineFacadeURL  string `mapstructure:"pine_facade_url"`
	SessionID      string `mapstructure:"sessionid"`
	SessionIDSign  string `mapstructure:"sessionid_sign"`
	RequestTimeout string `mapstructure:"request_timeout"`
	MaxRetries     int    `mapstructure:"max_retries"`
}

func (c TradingViewConfig) Timeout() time.Duration {
	d, err := time.ParseDuration(c.RequestTimeout)
	if err != nil || d <= 0 {
		return 10 * time.Second
	}
	return d
}

type SchedulerConfig struct {
	CookieCheck         string `mapstructure:"cookie_check"`
	ExpireScan          string `mapstructure:"expire_scan"`
	ScriptSync          string `mapstructure:"script_sync"`
	TVAccessSync        string `mapstructure:"tv_access_sync"`
	AccessAudit         string `mapstructure:"access_audit"`
	PaymentProofCleanup string `mapstructure:"payment_proof_cleanup"`
}

type AdminConfig struct {
	Username    string `mapstructure:"username"`
	Password    string `mapstructure:"password"`
	DisplayName string `mapstructure:"display_name"`
}

func Load(configPath string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")
	v.SetEnvPrefix("TVD")
	v.AutomaticEnv()

	v.SetDefault("server.port", 8080)
	v.SetDefault("server.mode", "debug")
	v.SetDefault("server.allowed_origins", []string{"http://localhost:5173"})
	v.SetDefault("server.log_level", "info")
	v.SetDefault("database.max_idle_conns", 10)
	v.SetDefault("database.max_open_conns", 50)
	v.SetDefault("database.conn_max_lifetime", "1h")
	v.SetDefault("database.conn_max_idle_time", "15m")
	v.SetDefault("jwt.cookie_domain", "")
	v.SetDefault("jwt.cookie_secure", false)
	v.SetDefault("jwt.cookie_same_site", "lax")
	v.SetDefault("jwt.admin_expire_hours", 24)
	v.SetDefault("jwt.agent_expire_hours", 12)
	v.SetDefault("jwt.refresh_hours", 168)
	v.SetDefault("tradingview.base_url", "https://cn.tradingview.com")
	v.SetDefault("tradingview.pine_facade_url", "https://pine-facade.tradingview.com/pine-facade")
	v.SetDefault("tradingview.request_timeout", "10s")
	v.SetDefault("tradingview.max_retries", 3)
	v.SetDefault("scheduler.cookie_check", "*/30 * * * *")
	v.SetDefault("scheduler.expire_scan", "*/10 * * * *")
	v.SetDefault("scheduler.script_sync", "0 3 * * *")
	v.SetDefault("scheduler.tv_access_sync", "0 3 * * *")
	v.SetDefault("scheduler.access_audit", "0 4 * * *")
	v.SetDefault("scheduler.payment_proof_cleanup", "30 4 * * *")

	if err := v.ReadInConfig(); err != nil {
		return nil, err
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
